# Gemini AI Integration Disclosure

**Kelly's Criterion Calculator**
**Effective Date:** December 21, 2025
**Last Updated:** December 21, 2025
**Version:** 1.0.0

---

## Overview

This document provides transparency about how Kelly's Criterion Calculator uses Google's Gemini AI service to generate optional analytical insights. We are committed to being clear about when and how AI is used in our application.

---

## 1. What is Gemini?

Gemini is a family of large language models (LLMs) developed by Google. Our App uses the **Gemini 1.5 Flash** model through Google's Generative Language API to generate brief, contextual commentary about betting calculations.

---

## 2. What Gemini Is Used For

When enabled, Gemini provides **optional "Analyst Insight" commentary** after a Kelly Criterion calculation is performed. These insights are:

- Brief explanations (1-2 sentences) of why a bet may or may not have value
- Contextual commentary based on the calculation results
- Educational observations about bankroll management

**Example Output:**
> "With a 55% win probability at -110 odds, this represents positive expected value. The recommended 4.5% bankroll allocation balances potential returns with prudent risk management."

---

## 3. What Data Is Shared with Gemini

When the AI insights feature is active, the following calculation data is transmitted to Google's Gemini API:

| Data Sent | Purpose |
|-----------|---------|
| Bankroll amount (e.g., "$1,000") | Context for stake recommendation |
| Betting odds (e.g., "-110") | Context for value assessment |
| Win probability (e.g., "55%") | Context for edge calculation |
| Calculated stake (e.g., "$45") | Result to explain |
| Stake percentage (e.g., "4.5%") | Result to explain |

### What Is NOT Sent

- Your name or identity
- Email address
- Account information
- IP address
- Location data
- Historical betting data
- Any other personally identifiable information (PII)

---

## 4. Gemini Is Optional and Non-Essential

### 4.1 Core Functionality Does Not Require Gemini

The primary function of Kelly's Criterion Calculator is performing mathematical calculations. **Gemini is completely optional.** The App works fully without Gemini integration.

### 4.2 Server Configuration

Gemini integration is controlled by server configuration:

- If no Gemini API key is configured, the feature is automatically disabled
- If Gemini is unavailable, calculations proceed normally without AI insights
- The App gracefully degrades to mathematical output only

### 4.3 No User Opt-In Required (Server-Level Decision)

Currently, the Gemini feature is enabled or disabled at the server level, not by individual users. If you prefer not to have your calculation data processed by Gemini, please contact us.

---

## 5. AI Outputs Are Informational Only

### 5.1 No Betting Advice

Gemini-generated insights are:

- **Informational and educational only**
- **NOT betting recommendations**
- **NOT financial advice**
- **NOT guarantees of any outcome**

### 5.2 AI Limitations

AI-generated content may:

- Contain errors or inaccuracies
- Not account for all relevant factors
- Vary in quality between requests
- Not reflect current events or real-time data

### 5.3 Your Responsibility

You should:

- Treat AI insights as supplementary commentary only
- Make your own independent decisions
- Consult qualified professionals before betting
- Never rely solely on AI-generated content

---

## 6. Google's AI Policies

Gemini operates under Google's policies and terms:

- **Google Privacy Policy:** https://policies.google.com/privacy
- **Google Terms of Service:** https://policies.google.com/terms
- **Generative AI Terms:** https://ai.google.dev/terms
- **Gemini API Terms:** https://ai.google.dev/gemini-api/terms

### 6.1 Data Processing by Google

When data is sent to Gemini:

- Google processes the data to generate responses
- Google's data handling practices apply
- We do not control how Google uses data sent to its API
- Please review Google's policies for details

### 6.2 API Key Security

- The Gemini API key is stored server-side only
- The API key is never exposed to clients or users
- API calls are made from our server, not from your device

---

## 7. Technical Implementation

### 7.1 API Configuration

```
Model: gemini-1.5-flash
Endpoint: generativelanguage.googleapis.com
Max Output Tokens: 100
Temperature: 0.9
```

### 7.2 System Prompt

Gemini is instructed to:

- Act as a "seasoned betting analyst"
- Provide brief (1-2 sentences) explanations
- Maintain a responsible and clear tone
- Focus on the mathematical reasoning behind recommendations

### 7.3 Error Handling

If Gemini fails to respond:

- No error is shown to the user
- The calculation result is returned without an insight
- The App continues to function normally

---

## 8. Data Retention

### 8.1 Our Retention

We do **NOT** store or log the data sent to Gemini. Data exists only in memory during the API request.

### 8.2 Google's Retention

Google's data retention policies apply to data processed by Gemini. Please consult Google's privacy documentation for details on their retention practices.

---

## 9. Your Rights

### 9.1 Opt-Out

If you do not wish for your calculation data to be processed by Gemini, please contact us at privacy@kellyscriterion.app. We can discuss available options.

### 9.2 Questions

For questions about Gemini integration, contact:

**Email:** privacy@kellyscriterion.app
**Subject:** Gemini AI Inquiry

---

## 10. Changes to This Disclosure

We may update this disclosure as our AI integration evolves. Material changes will be reflected in the "Last Updated" date.

---

## Summary

| Aspect | Details |
|--------|---------|
| AI Provider | Google Gemini (1.5 Flash) |
| Purpose | Generate brief analytical insights |
| Data Shared | Bankroll, odds, probability, calculated stake |
| PII Shared | None |
| Required for App | No (optional feature) |
| Advice Provided | No (informational only) |
| User Control | Contact us to discuss options |

---

*This disclosure is provided to ensure transparency about AI usage in Kelly's Criterion Calculator.*
