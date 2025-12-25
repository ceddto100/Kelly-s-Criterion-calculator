# Betgistics Compliance Implementation Guide

## Overview

This guide helps developers implement the Betgistics compliance framework across all aspects of the application. It provides step-by-step instructions for integrating safety guardrails, updating tool descriptions, and maintaining compliance.

---

## 📁 Documentation Structure

The Betgistics compliance framework consists of four key documents:

1. **PLATFORM_METADATA.md** (Comprehensive Framework)
   - Complete compliance specifications
   - All required outputs (descriptions, guard rails, language rules)
   - Safety positioning statements
   - Use for: Deep reference, policy questions, audit preparation

2. **ASSISTANT_SYSTEM_PROMPT.md** (AI Behavioral Rules)
   - System prompts for AI assistants
   - Behavioral constraints and rules
   - Response templates and examples
   - Use for: Configuring ChatGPT, Claude, Gemini integrations

3. **COMPLIANCE_QUICK_REFERENCE.md** (Daily Use Guide)
   - Quick language dos and don'ts
   - Fast compliance checks
   - Common templates
   - Use for: Content creation, daily development, quick reviews

4. **APP_STORE_METADATA.json** (Store Submission Data)
   - Complete app metadata
   - Tool descriptions
   - Compliance flags
   - Use for: App store submissions, metadata configuration

5. **This Document** (Implementation Guide)
   - Step-by-step integration instructions
   - Code examples
   - Testing procedures

---

## 🚀 Implementation Steps

### Step 1: Update MCP Server Configuration

#### 1.1 Update Server Name and Description

**File:** `mcp-server/src/server.ts`

```typescript
// Update server initialization
const mcpServer = new McpServer({
  name: 'betgistics', // Changed from 'kelly-criterion-calculator'
  version: '2.0.0'
});

// Update root endpoint response
app.get('/', (req, res) => {
  res.json({
    name: 'Betgistics Sports Analytics Education',
    version: '2.0.0',
    description: 'Educational MCP server for learning probability theory and statistical analysis through sports data.',
    disclaimer: 'For educational purposes only. Does not provide betting advice or guarantee outcomes.',
    // ... rest of configuration
  });
});
```

---

### Step 2: Update Tool Descriptions

All tool descriptions must use educational, non-prescriptive language. Here's how to update each tool:

#### 2.1 Kelly Criterion Calculator

**File:** `mcp-server/src/tools/kelly.ts`

**Current description:**
```typescript
description: 'Calculate optimal bet size using Kelly Criterion...'
```

**Updated description:**
```typescript
description: 'Educational demonstration of Kelly Criterion theory for hypothetical resource allocation under uncertainty. Learn how this mathematical formula works and understand its assumptions. For educational purposes only, not financial or betting advice. Use this when the user wants to learn about Kelly Criterion concepts.',
```

**Update tool registration:**
```typescript
server.tool(
  'kelly-calculate',
  {
    title: 'Kelly Criterion Educational Calculator',
    description: 'Educational demonstration of Kelly Criterion theory for hypothetical resource allocation under uncertainty. Learn how this mathematical formula works and understand its assumptions. For educational purposes only, not financial or betting advice.',
    inputSchema: {
      // ... existing schema with updated descriptions
      probability: z.number().min(0.1).max(99.9).describe(
        'Estimated win probability as a percentage for this educational demonstration. ' +
        'Example: 55 for 55% estimated likelihood. Valid range: 0.1% to 99.9%. ' +
        'This is for learning purposes - probability estimation is complex in practice.'
      ),
      // ... rest of schema
    },
    annotations: {
      readOnlyHint: false,
      openWorldHint: true,
      destructiveHint: false
    }
  },
  async (args, extra) => {
    // ... existing implementation
  }
);
```

#### 2.2 Probability Estimation Tools

**File:** `mcp-server/src/tools/probabilityUnified.ts`

**Add to the beginning of the file:**
```typescript
/**
 * Educational probability estimation tool
 *
 * COMPLIANCE NOTE:
 * This tool demonstrates statistical inference methods for educational purposes.
 * All outputs must be framed as probability estimates, not predictions.
 * Include disclaimers about educational purpose and model limitations.
 */
```

**Update tool description:**
```typescript
server.tool(
  'probability-estimate',
  {
    title: 'Unified Probability Estimation (Educational)',
    description: 'Educational tool for learning probability estimation techniques using historical sports data. Auto-detects sport (NBA/NFL) from team names. Demonstrates statistical inference methods and uncertainty quantification. Outputs are informational probability models for learning purposes, not predictions or betting advice.',
    inputSchema: {
      team1: z.string().describe('First team name (can use city, mascot, or abbreviation)'),
      team2: z.string().describe('Second team name'),
      spread: z.number().describe('Point spread for educational probability calculation'),
      sport: z.enum(['nba', 'nfl', 'auto']).optional().describe('Sport type (auto-detects if not specified)')
    },
    // ... rest of configuration
  },
  async (args, extra) => {
    // ... implementation

    // Update return format to include educational disclaimers
    return {
      content: [{
        type: 'text',
        text: `Educational Probability Estimate\n\n` +
              `Estimated probability range: ${probLow}% - ${probHigh}%\n` +
              `Confidence level: ${confidence}\n\n` +
              `Methodology: Statistical analysis of historical performance data\n` +
              `Limitations: ${limitations}\n\n` +
              `This is an educational probability model for learning purposes. ` +
              `Past performance does not indicate future results.`
      }],
      structuredContent: {
        probabilityRange: { low: probLow, high: probHigh },
        methodology: 'historical-statistical-analysis',
        confidence: confidence,
        educational: true,
        disclaimer: 'For educational purposes only. Not a prediction or betting advice.'
      },
      _meta: {
        'openai/locale': locale,
        'educational': true,
        'type': 'probability-estimate'
      }
    };
  }
);
```

---

### Step 3: Update AI Assistant Integration

#### 3.1 For ChatGPT Integration

**Create/Update file:** `mcp-server/src/config/chatgpt-instructions.txt`

```
You are Betgistics, an educational sports analytics assistant.

CRITICAL BEHAVIORAL RULES:

1. NEVER encourage gambling or provide betting advice
2. NEVER claim guaranteed outcomes or certainties
3. ALWAYS frame outputs as educational and informational
4. ALWAYS emphasize user responsibility for decisions
5. ALWAYS include appropriate disclaimers

When using tools:
- Kelly Criterion: Present as "hypothetical scenario" or "theoretical model"
- Probability Estimates: Use "probability range" not "prediction"
- Team Stats: Focus on "historical data analysis" not "future outcomes"

Standard disclaimer to include:
"This is an educational tool for learning about probability and statistics.
All information is for learning purposes only. You are responsible for
your own decisions."

For full behavioral guidelines, refer to: ASSISTANT_SYSTEM_PROMPT.md
```

#### 3.2 For Gemini Integration

**File:** `mcp-server/src/utils/gemini.ts`

**Update system instruction:**
```typescript
const systemInstruction = `You are Betgistics, an educational sports analytics assistant.

COMPLIANCE REQUIREMENTS:
- You provide educational content about probability theory and statistical analysis
- You do NOT provide betting advice or gambling recommendations
- You do NOT guarantee outcomes or claim certainty about future events
- You emphasize that all outputs are for learning purposes only
- You always remind users they are responsible for their own decisions

RESPONSE STYLE:
- Educational and analytical (not prescriptive)
- Acknowledge uncertainty and model limitations
- Use "probability estimate" not "prediction"
- Frame Kelly Criterion as "theoretical demonstration"
- Include disclaimers about educational purpose

PROHIBITED:
- Never say "bet on this" or "place a wager"
- Never claim "guaranteed win" or "sure thing"
- Never use language like "lock", "can't miss", "will definitely win"
- Never encourage gambling behavior

Your tone should be educational, responsible, and analytical. Focus on teaching
probability concepts and statistical thinking, not making predictions or decisions
for users.`;

// Update user prompt to include educational framing
const userPrompt = `Provide a brief educational insight (1-2 sentences) about this hypothetical scenario:

Bankroll: $${params.bankroll}
Odds: ${params.odds}
Win Probability Estimate: ${params.probability}%
Theoretical Kelly Stake: $${stake} (${percentage.toFixed(2)}% of bankroll)

Frame this as an educational observation about risk management and probability theory.
Do not provide betting advice or encourage wagering. Focus on the learning aspect.`;
```

---

### Step 4: Add Disclaimers to UI

#### 4.1 Widget Components

**File:** `chatgpt-widgets/src/components/KellyCalculator.tsx`

Add disclaimer section:
```tsx
function KellyCalculator() {
  return (
    <div className="kelly-calculator">
      {/* Existing UI components */}

      <div className="educational-disclaimer">
        <p className="disclaimer-text">
          <strong>Educational Tool:</strong> This demonstrates Kelly Criterion theory
          for learning purposes only. Not financial or betting advice. Results shown
          are theoretical and for educational exploration.
        </p>
      </div>

      {/* Rest of component */}
    </div>
  );
}
```

**Add to CSS:**
```css
.educational-disclaimer {
  margin: 16px 0;
  padding: 12px;
  background-color: #f8f9fa;
  border-left: 4px solid #0066cc;
  font-size: 0.9em;
}

.disclaimer-text {
  margin: 0;
  color: #495057;
}
```

#### 4.2 Landing Page / App Description

**File:** `frontend/src/components/LandingPage.tsx` (if exists)

```tsx
<section className="hero">
  <h1>Betgistics</h1>
  <p className="tagline">Sports Analytics & Probability Education</p>

  <div className="value-proposition">
    <h2>Learn Probability Theory Through Sports Data</h2>
    <p>
      Betgistics is an educational assistant for learning about probability theory,
      statistical analysis, and risk management concepts using sports data as a
      practical context.
    </p>

    <div className="key-points">
      <div className="what-it-is">
        <h3>What Betgistics Provides:</h3>
        <ul>
          <li>Probability modeling education</li>
          <li>Statistical analysis tools</li>
          <li>Risk management concept demonstrations</li>
          <li>Data-driven decision analysis frameworks</li>
        </ul>
      </div>

      <div className="what-it-isnt">
        <h3>What Betgistics Does NOT Do:</h3>
        <ul>
          <li>Does not facilitate real-money betting</li>
          <li>Does not provide betting advice</li>
          <li>Does not guarantee outcomes</li>
          <li>Does not connect to sportsbooks</li>
        </ul>
      </div>
    </div>

    <p className="age-restriction">
      <strong>18+ Educational Tool</strong> • For Learning Purposes Only
    </p>
  </div>
</section>
```

---

### Step 5: Update Environment Configuration

**File:** `.env.example`

Add compliance-related configuration:
```bash
# App Configuration
APP_NAME=Betgistics
APP_VERSION=2.0.0
APP_MODE=educational

# Compliance Settings
ENABLE_EDUCATIONAL_DISCLAIMERS=true
ENABLE_GAMBLING_PREVENTION=true
ASSISTANT_GUARD_RAILS=strict

# Feature Flags
ENABLE_KELLY_CALCULATOR=true
ENABLE_PROBABILITY_TOOLS=true
ENABLE_TEAM_STATS=true

# API Keys
GEMINI_API_KEY=your_api_key_here

# Server Configuration
PORT=3000
ALLOWED_ORIGINS=https://chatgpt.com
DEBUG_MCP=false
```

---

### Step 6: Implement Output Validation

Create a validation utility to check all AI-generated outputs:

**File:** `mcp-server/src/utils/complianceValidator.ts`

```typescript
/**
 * Compliance validation utility
 * Checks outputs for prohibited language and missing disclaimers
 */

// Prohibited terms that should never appear in outputs
const PROHIBITED_TERMS = [
  /\bbet now\b/i,
  /\bplace (?:a )?bet\b/i,
  /\bguaranteed win\b/i,
  /\bsure thing\b/i,
  /\block of the day\b/i,
  /\bcan't miss\b/i,
  /\bmake money\b/i,
  /\bwill (?:definitely )?win\b/i,
  /\bprofitable system\b/i,
  /\bwinning edge\b/i,
  /\bbet this amount\b/i
];

// Required disclaimers for specific tool types
const REQUIRED_DISCLAIMERS = {
  'kelly-calculate': ['educational', 'hypothetical', 'not advice'],
  'probability-estimate': ['educational', 'not prediction', 'learning purposes'],
  'default': ['educational', 'learning purposes']
};

export interface ValidationResult {
  isCompliant: boolean;
  violations: string[];
  warnings: string[];
}

export function validateOutput(
  toolName: string,
  outputText: string
): ValidationResult {
  const violations: string[] = [];
  const warnings: string[] = [];

  // Check for prohibited terms
  for (const term of PROHIBITED_TERMS) {
    if (term.test(outputText)) {
      violations.push(`Contains prohibited term: ${term.source}`);
    }
  }

  // Check for required disclaimers
  const requiredDisclaimers = REQUIRED_DISCLAIMERS[toolName] || REQUIRED_DISCLAIMERS.default;
  const lowerOutput = outputText.toLowerCase();

  for (const disclaimer of requiredDisclaimers) {
    if (!lowerOutput.includes(disclaimer)) {
      warnings.push(`Missing recommended disclaimer: "${disclaimer}"`);
    }
  }

  // Check for certainty language
  const certaintyPatterns = [
    /\bwill\b.*\b(?:win|lose|happen|occur)\b/i,
    /\bguarantee/i,
    /\bdefinitely\b/i,
    /\bcertainly\b.*\b(?:win|lose)\b/i
  ];

  for (const pattern of certaintyPatterns) {
    if (pattern.test(outputText)) {
      violations.push(`Contains certainty language: ${pattern.source}`);
    }
  }

  return {
    isCompliant: violations.length === 0,
    violations,
    warnings
  };
}

// Middleware to validate all tool outputs
export function createComplianceMiddleware() {
  return async (toolName: string, output: any) => {
    if (process.env.ENABLE_COMPLIANCE_VALIDATION !== 'false') {
      const textContent = typeof output === 'string'
        ? output
        : output.content?.[0]?.text || JSON.stringify(output);

      const validation = validateOutput(toolName, textContent);

      if (!validation.isCompliant) {
        console.error('[COMPLIANCE] Violations detected:', validation.violations);

        // In production, you might want to block or modify the output
        if (process.env.NODE_ENV === 'production') {
          throw new Error('Output failed compliance validation');
        }
      }

      if (validation.warnings.length > 0) {
        console.warn('[COMPLIANCE] Warnings:', validation.warnings);
      }
    }

    return output;
  };
}
```

**Usage in tool handlers:**

```typescript
import { createComplianceMiddleware } from '../utils/complianceValidator.js';

const complianceCheck = createComplianceMiddleware();

server.tool('kelly-calculate', schema, async (args) => {
  const result = await calculateKelly(args);

  // Validate output before returning
  return await complianceCheck('kelly-calculate', result);
});
```

---

### Step 7: Testing & Validation

#### 7.1 Create Compliance Test Suite

**File:** `mcp-server/src/__tests__/compliance.test.ts`

```typescript
import { validateOutput } from '../utils/complianceValidator';

describe('Compliance Validation', () => {
  describe('Prohibited Terms Detection', () => {
    it('should flag "bet now" language', () => {
      const output = "You should bet now on Team A!";
      const result = validateOutput('default', output);

      expect(result.isCompliant).toBe(false);
      expect(result.violations).toContain(expect.stringContaining('bet now'));
    });

    it('should flag "guaranteed win" language', () => {
      const output = "This is a guaranteed win for Team B.";
      const result = validateOutput('default', output);

      expect(result.isCompliant).toBe(false);
      expect(result.violations).toContain(expect.stringContaining('guaranteed'));
    });

    it('should flag certainty language', () => {
      const output = "Team A will definitely win this game.";
      const result = validateOutput('default', output);

      expect(result.isCompliant).toBe(false);
    });
  });

  describe('Educational Outputs', () => {
    it('should pass compliant Kelly output', () => {
      const output = `Educational Demonstration:

        In this hypothetical scenario with 55% estimated probability,
        the theoretical Kelly percentage would be 3.2%.

        This is for learning purposes only, not financial advice.`;

      const result = validateOutput('kelly-calculate', output);
      expect(result.isCompliant).toBe(true);
    });

    it('should pass compliant probability output', () => {
      const output = `Educational Probability Estimate:

        Based on historical statistical analysis, estimated probability
        range is 48-54% with moderate confidence.

        This is an educational probability model for learning purposes.
        Not a prediction or guarantee of outcomes.`;

      const result = validateOutput('probability-estimate', output);
      expect(result.isCompliant).toBe(true);
    });
  });
});
```

**Run tests:**
```bash
cd mcp-server
npm test -- compliance.test.ts
```

---

### Step 8: Documentation Updates

#### 8.1 Update README.md

Add compliance section to the main README:

```markdown
## Compliance & Safety

Betgistics is designed as an **educational tool** for learning about probability theory
and statistical analysis. It is NOT a gambling application.

### Key Principles:

- **Educational Focus**: All features are designed for learning, not betting
- **No Gambling Facilitation**: Does not connect to sportsbooks or handle real money
- **User Responsibility**: Users are responsible for their own decisions
- **Transparency**: Clear about limitations, assumptions, and uncertainties

### Documentation:

- [Platform Metadata & Compliance](./PLATFORM_METADATA.md) - Complete compliance framework
- [Assistant System Prompt](./ASSISTANT_SYSTEM_PROMPT.md) - AI behavioral guardrails
- [Quick Reference Guide](./COMPLIANCE_QUICK_REFERENCE.md) - Language dos and don'ts
- [Implementation Guide](./COMPLIANCE_IMPLEMENTATION_GUIDE.md) - This document

For questions about compliance, contact: legal@betgistics.app
```

---

### Step 9: Deployment Checklist

Before deploying to production:

- [ ] All tool descriptions updated to educational language
- [ ] System prompts configured with guard rails
- [ ] Disclaimers added to all UI components
- [ ] Compliance validation middleware enabled
- [ ] Tests passing for prohibited language detection
- [ ] Environment variables configured correctly
- [ ] App store metadata updated
- [ ] Privacy policy and terms of service reviewed
- [ ] Age restrictions clearly communicated
- [ ] Educational positioning consistent across all touchpoints

---

### Step 10: Monitoring & Maintenance

#### 10.1 Set Up Compliance Monitoring

**Create logging for compliance issues:**

```typescript
// mcp-server/src/utils/complianceLogger.ts

export function logComplianceEvent(event: {
  type: 'violation' | 'warning' | 'edge-case';
  toolName: string;
  message: string;
  context?: any;
}) {
  const timestamp = new Date().toISOString();

  console.log(`[COMPLIANCE ${event.type.toUpperCase()}] ${timestamp}`, {
    tool: event.toolName,
    message: event.message,
    context: event.context
  });

  // In production, send to monitoring service
  if (process.env.NODE_ENV === 'production') {
    // sendToMonitoringService(event);
  }
}
```

#### 10.2 Regular Review Schedule

- **Weekly**: Review compliance logs for any edge cases
- **Monthly**: Check for new prohibited language patterns
- **Quarterly**: Full compliance audit
- **Annually**: Review against updated platform policies

---

## 🎯 Quick Implementation Checklist

Use this checklist to verify implementation:

### Server Configuration
- [ ] Server name changed to "betgistics"
- [ ] Version updated to 2.0.0
- [ ] Educational disclaimer in root endpoint

### Tool Descriptions
- [ ] Kelly calculator uses "educational demonstration" language
- [ ] Probability tools use "probability estimate" not "prediction"
- [ ] All tools include "for educational purposes" disclaimer
- [ ] No tools use prohibited language (bet, guarantee, etc.)

### AI Assistant Integration
- [ ] System prompts configured with behavioral guardrails
- [ ] Response templates use approved language
- [ ] Disclaimers included in all tool outputs
- [ ] Prohibited language patterns blocked

### UI/UX
- [ ] Educational disclaimers visible in widgets
- [ ] Landing page explains what app IS and ISN'T
- [ ] Age restrictions clearly displayed
- [ ] No gambling imagery or promotional language

### Code Quality
- [ ] Compliance validation middleware implemented
- [ ] Output validation tests passing
- [ ] Prohibited terms detection working
- [ ] Logging configured for compliance events

### Documentation
- [ ] README updated with compliance section
- [ ] All compliance documents accessible
- [ ] Implementation guide followed
- [ ] Team trained on compliance requirements

---

## 📞 Support & Questions

**For compliance questions:**
- Review: PLATFORM_METADATA.md (comprehensive reference)
- Quick check: COMPLIANCE_QUICK_REFERENCE.md
- Contact: legal@betgistics.app

**For implementation help:**
- This document: Step-by-step instructions
- Contact: support@betgistics.app

---

## 🔄 Version History

- **v1.0.0** (2025-12-25): Initial compliance framework implementation guide

---

*Remember: When in doubt about compliance, default to safety. It's better to be overly cautious than to risk policy violations.*
