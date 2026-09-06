# Privacy Policy

**Kelly's Criterion Calculator**
**Effective Date:** December 21, 2025
**Last Updated:** December 21, 2025
**Version:** 1.0.0

---

## 1. Introduction

This Privacy Policy describes how Kelly's Criterion Calculator ("the App," "we," "us," or "our") collects, uses, shares, and protects information when you use our Model Context Protocol (MCP) server integrated with ChatGPT.

By using the App, you agree to the collection and use of information in accordance with this policy. If you do not agree with this policy, please do not use the App.

---

## 2. Data We Collect

### 2.1 MCP Server (Primary Service)

The core MCP server operates in a **stateless manner** and does not persistently store any user data. During a calculation session, we temporarily process the following information:

| Data Type | Purpose | Persistence |
|-----------|---------|-------------|
| Bankroll amount | Calculate optimal bet size | Not stored |
| Betting odds | Perform Kelly Criterion calculation | Not stored |
| Win probability | Calculate expected value | Not stored |
| Kelly fraction preference | Adjust calculation conservatism | Not stored |
| Locale/language preference | Provide localized responses | Not stored |

**Important:** None of the above data is logged, saved to a database, or retained after your session ends.

### 2.2 Optional AI Insights Feature

If the AI analyst insights feature is enabled (server configuration), the following data may be transmitted to Google's Gemini API:

- Bankroll amount
- Betting odds
- Win probability estimate
- Calculated stake recommendation

This data is sent to Google for the sole purpose of generating a brief analytical insight. See Section 4 and our [Gemini AI Disclosure](GEMINI_AI_DISCLOSURE.md) for more details.

### 2.3 Legacy Backend (If Applicable)

A separate legacy backend system exists for users who opt into account-based features. If you use the legacy backend with Google OAuth authentication, the following data may be collected:

| Data Type | Purpose | Retention |
|-----------|---------|-----------|
| Google OAuth identifier | Account identification | Until account deletion |
| Email address | Account communication | Until account deletion |
| Display name | Personalization | Until account deletion |
| Bankroll history | Track betting performance | Until account deletion |
| Bet logs (matchups, wagers, outcomes) | Historical analysis | Until account deletion |

**Note:** The legacy backend is a separate, optional service. The core MCP server ChatGPT integration does not require or use the legacy backend.

---

## 3. How We Use Your Data

We use the information we collect solely for the following purposes:

1. **Perform Calculations:** Process Kelly Criterion and probability calculations based on your inputs
2. **Generate AI Insights:** If enabled, provide optional AI-generated analytical commentary
3. **Localization:** Display results in your preferred language
4. **Improve Service:** Aggregate, anonymized error logs may be used to improve reliability

We do **NOT** use your data for:
- Targeted advertising
- Sale to third parties
- Profiling or behavioral tracking
- Marketing communications (unless you explicitly opt in)

---

## 4. Data Sharing and Third-Party Services

### 4.1 Google Gemini API (Optional)

If the AI insights feature is enabled, your calculation inputs (bankroll, odds, probability) are transmitted to Google's Gemini API to generate analytical commentary. This transmission:

- Occurs only when the feature is server-enabled
- Is subject to [Google's Privacy Policy](https://policies.google.com/privacy)
- Is subject to [Google's Generative AI Terms](https://ai.google.dev/terms)
- Does not include any personally identifiable information

For complete details, see our [Gemini AI Disclosure](GEMINI_AI_DISCLOSURE.md).

### 4.2 Google OAuth (Legacy Backend Only)

If you use the optional legacy backend with Google Sign-In, authentication is handled by Google OAuth 2.0. Google's privacy practices apply to the authentication process.

### 4.3 No Other Third-Party Sharing

We do not share, sell, rent, or trade your personal information with any other third parties for their promotional or marketing purposes.

---

## 5. Data Retention

### 5.1 MCP Server

The MCP server is stateless. **No user data is retained** after a calculation request is completed. Data exists only in memory during the processing of your request.

### 5.2 Legacy Backend

For users of the optional legacy backend:

| Data Category | Retention Period |
|---------------|------------------|
| Account information | Until you delete your account |
| Bet history | Until you delete your account |
| Calculation logs | Until you delete your account |

You may request deletion of your account and associated data at any time (see Section 6).

---

## 6. User Rights and Data Deletion

You have the following rights regarding your data:

### 6.1 Right to Access
You may request a copy of any personal data we hold about you.

### 6.2 Right to Correction
You may request correction of inaccurate personal data.

### 6.3 Right to Deletion
You may request deletion of your personal data. For the MCP server, no action is required as no data is stored. For the legacy backend, contact us to delete your account.

### 6.4 Right to Data Portability
You may request your data in a structured, machine-readable format.

### 6.5 How to Exercise Your Rights

To exercise any of these rights, contact us at:

**Email:** privacy@kellyscriterion.app
**Subject Line:** "Privacy Rights Request"

We will respond to your request within 30 days.

---

## 7. Children's Privacy

**The App is not intended for use by anyone under the age of 18.**

We do not knowingly collect personal information from children under 13 years of age. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately. If we discover that we have collected personal information from a child under 13, we will delete that information promptly.

Given the nature of this App (betting calculations), users must be of legal gambling age in their jurisdiction to use this service.

---

## 8. Security Practices

We implement appropriate technical and organizational measures to protect your data:

- **Server-Side API Keys:** All third-party API keys (including Gemini) are stored server-side only and never exposed to clients
- **Input Validation:** All user inputs are validated using schema validation (Zod) to prevent injection attacks
- **CORS Protection:** Cross-origin requests are restricted to authorized domains
- **HTTPS:** All data transmission occurs over encrypted connections
- **No Logging:** The MCP server does not log user calculation data
- **Rate Limiting:** Request rate limiting prevents abuse

While we strive to protect your data, no method of transmission over the Internet or electronic storage is 100% secure. We cannot guarantee absolute security.

---

## 9. International Data Transfers

If you access the App from outside the United States, your data may be transferred to and processed in the United States or other countries where our servers or third-party service providers are located. By using the App, you consent to such transfers.

---

## 10. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify you of any material changes by:

- Updating the "Last Updated" date at the top of this policy
- Posting a notice within the App (if applicable)

Your continued use of the App after any changes indicates your acceptance of the updated policy.

---

## 11. Contact Information

If you have questions or concerns about this Privacy Policy or our data practices, please contact us:

**Email:** privacy@kellyscriterion.app
**Subject:** Privacy Inquiry

**Developer:**
Kelly's Criterion Calculator Team
support@kellyscriterion.app

---

## 12. Additional Disclosures

### 12.1 California Residents (CCPA)

California residents have additional rights under the California Consumer Privacy Act (CCPA). You may request disclosure of the categories of personal information collected and the purposes for collection. We do not sell personal information.

### 12.2 European Users (GDPR)

If you are located in the European Economic Area (EEA), you have rights under the General Data Protection Regulation (GDPR), including access, rectification, erasure, restriction, and data portability. Our legal basis for processing is legitimate interest (providing the calculation service you request) or consent where applicable.

---

*This Privacy Policy is provided in good faith and is intended to be compliant with applicable laws and OpenAI App Store requirements.*
