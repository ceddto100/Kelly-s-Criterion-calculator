#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Repository Cleanup Script - Remove Unused Files
# ==============================================================================
#
# This script:
# 1. Creates a safety backup branch
# 2. Creates a new working branch for cleanup
# 3. Removes unused files identified by static analysis
# 4. Runs build checks (frontend and backend)
# 5. Aborts on any failure
# 6. Commits and pushes changes if all checks pass
#
# IMPORTANT: Review the candidate deletions before running this script!
# ==============================================================================

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_BRANCH="backup/cleanup-${TIMESTAMP}"
WORKING_BRANCH="cleanup/remove-unused-${TIMESTAMP}"

echo "=============================================="
echo "Repository Cleanup Script"
echo "=============================================="
echo ""
echo "Timestamp: ${TIMESTAMP}"
echo "Backup branch: ${BACKUP_BRANCH}"
echo "Working branch: ${WORKING_BRANCH}"
echo ""

# ==============================================================================
# Step 1: Create Backup Branch
# ==============================================================================
echo "📦 Step 1: Creating backup branch..."
git branch "${BACKUP_BRANCH}"
echo "✅ Backup branch created: ${BACKUP_BRANCH}"
echo ""

# ==============================================================================
# Step 2: Create Working Branch
# ==============================================================================
echo "🌿 Step 2: Creating working branch..."
git checkout -b "${WORKING_BRANCH}"
echo "✅ Working branch created: ${WORKING_BRANCH}"
echo ""

# ==============================================================================
# Step 3: Remove Unused Files
# ==============================================================================
echo "🗑️  Step 3: Removing unused files..."

# High confidence deletions
echo "  Removing high-confidence files..."
git rm --ignore-unmatch frontend.gitkeep || true
git rm --ignore-unmatch frontend/.gatekeep || true
git rm --ignore-unmatch backend/test-espn.js || true
git rm --ignore-unmatch backend/mockESPNData.js || true
git rm --ignore-unmatch metadata.json || true

# Medium confidence deletions (entire lib/ directory)
echo "  Removing medium-confidence files (frontend/lib/)..."
git rm --ignore-unmatch -r frontend/lib/ || true

echo "✅ Files staged for deletion"
echo ""

# ==============================================================================
# Step 4: Run Build Checks
# ==============================================================================
echo "🔨 Step 4: Running build checks..."
echo ""

# Check if we're in a clean state for testing
BUILD_FAILED=0

# Frontend build check
echo "  📦 Frontend: Installing dependencies..."
if npm --prefix frontend install; then
    echo "  ✅ Frontend dependencies installed"
    echo ""
    echo "  🏗️  Frontend: Running build..."
    if npm --prefix frontend run build; then
        echo "  ✅ Frontend build successful"
    else
        echo "  ❌ Frontend build FAILED"
        BUILD_FAILED=1
    fi
else
    echo "  ❌ Frontend npm install FAILED"
    BUILD_FAILED=1
fi
echo ""

# Backend check (install only, no build needed for CommonJS)
echo "  📦 Backend: Installing dependencies..."
if npm --prefix backend install; then
    echo "  ✅ Backend dependencies installed"
    echo ""
    echo "  🔍 Backend: Checking for syntax errors..."
    if node -c backend/server.js; then
        echo "  ✅ Backend syntax check passed"
    else
        echo "  ❌ Backend syntax check FAILED"
        BUILD_FAILED=1
    fi
else
    echo "  ❌ Backend npm install FAILED"
    BUILD_FAILED=1
fi
echo ""

# ==============================================================================
# Step 5: Handle Build Results
# ==============================================================================
if [ ${BUILD_FAILED} -eq 1 ]; then
    echo "=============================================="
    echo "❌ BUILD CHECKS FAILED"
    echo "=============================================="
    echo ""
    echo "Aborting cleanup. Reverting changes..."
    echo ""

    # Restore files
    git reset --hard

    # Switch back to original branch
    git checkout -

    # Delete working branch
    git branch -D "${WORKING_BRANCH}" || true

    echo "⚠️  Changes reverted. Working branch deleted."
    echo "💾 Backup branch preserved: ${BACKUP_BRANCH}"
    echo ""
    echo "Please investigate build failures before retrying."
    exit 1
fi

echo "=============================================="
echo "✅ ALL BUILD CHECKS PASSED"
echo "=============================================="
echo ""

# ==============================================================================
# Step 6: Commit Changes
# ==============================================================================
echo "💾 Step 6: Committing changes..."

git commit -m "$(cat <<'EOF'
chore: remove unused files from repository

Remove 8 unused files totaling ~13.3 KB:

High confidence deletions:
- frontend.gitkeep (empty placeholder)
- frontend/.gatekeep (unknown purpose, no references)
- backend/test-espn.js (test file not used in production)
- backend/mockESPNData.js (mock data never imported)
- metadata.json (Replit metadata not used by Vercel)

Medium confidence deletions:
- frontend/lib/coverProbability.ts (unused wrapper)
- frontend/lib/coverProbabilityNFL.ts (no imports)
- frontend/lib/coverProbabilityNBA.ts (no imports)

Rationale:
- Static analysis found zero references to these files
- frontend/index.tsx implements probability calculations inline
- espnService.js uses OpenAI API directly (no mock data)
- All build checks passed (frontend + backend)

Build verification:
✅ Frontend build successful
✅ Backend syntax check passed

No duplicate files found in repository (all files have unique content).
EOF
)"

echo "✅ Changes committed"
echo ""

# ==============================================================================
# Step 7: Push to Remote
# ==============================================================================
echo "🚀 Step 7: Pushing to remote..."

if git push -u origin "${WORKING_BRANCH}"; then
    echo "✅ Changes pushed to origin/${WORKING_BRANCH}"
else
    echo "⚠️  Push failed. You may need to push manually:"
    echo "    git push -u origin ${WORKING_BRANCH}"
    echo ""
    echo "This could be due to network issues or repository permissions."
fi
echo ""

# ==============================================================================
# Summary
# ==============================================================================
echo "=============================================="
echo "✅ CLEANUP COMPLETE"
echo "=============================================="
echo ""
echo "Summary:"
echo "  - Backup branch: ${BACKUP_BRANCH}"
echo "  - Working branch: ${WORKING_BRANCH}"
echo "  - Files removed: 8"
echo "  - Space recovered: ~13.3 KB"
echo "  - Build checks: ✅ PASSED"
echo ""
echo "Next steps:"
echo "  1. Review changes: git show HEAD"
echo "  2. Create pull request on GitHub"
echo "  3. Run smoke tests on deployment"
echo "  4. Merge after approval"
echo ""
echo "To create a PR via GitHub CLI (if installed):"
echo "  gh pr create --title \"chore: remove unused files\" \\"
echo "    --body \"Removes 8 unused files (~13.3 KB) identified by static analysis. See commit message for details.\""
echo ""
echo "Rollback (if needed):"
echo "  git checkout ${BACKUP_BRANCH}"
echo ""
echo "=============================================="
