# Legal Documentation

This directory contains the public-facing legal documentation for Kelly's Criterion Calculator, hosted via GitHub Pages.

## Files

- **index.html** - Landing page with links to all legal documents
- **privacy.html** - Privacy Policy
- **terms.html** - Terms of Service
- **gemini-disclosure.html** - Gemini AI Integration Disclosure

## GitHub Pages Setup

To enable GitHub Pages for this repository:

1. Go to **Settings** → **Pages**
2. Under **Source**, select **Deploy from a branch**
3. Select branch: `main` (or your default branch)
4. Select folder: `/docs`
5. Click **Save**

Your legal documents will be accessible at:
```
https://<username>.github.io/Kelly-s-Criterion-calculator/
https://<username>.github.io/Kelly-s-Criterion-calculator/privacy.html
https://<username>.github.io/Kelly-s-Criterion-calculator/terms.html
https://<username>.github.io/Kelly-s-Criterion-calculator/gemini-disclosure.html
```

## Update APP_STORE_METADATA.json

After GitHub Pages is enabled, update the `policy_urls` section in `APP_STORE_METADATA.json` with your actual GitHub Pages URLs.

## Custom Domain (Optional)

If you have a custom domain (e.g., kellyscriterion.app):

1. Add a CNAME file in this directory with your domain
2. Configure DNS settings with your domain registrar
3. Update APP_STORE_METADATA.json with your custom domain URLs
