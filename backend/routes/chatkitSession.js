/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ChatKit Session Endpoint
 * Creates secure OpenAI ChatKit sessions and returns client secrets
 */

const express = require('express');
const router = express.Router();

// ChatKit workflow configuration
const WORKFLOW_ID = "wf_6913ae8d21588190822630566a8233ca0416772e440b6b71";
const WORKFLOW_VERSION = "2";

/**
 * POST /api/chatkit/session
 * Creates a new ChatKit session and returns a client secret
 */
router.post('/session', async (req, res) => {
  console.log('ChatKit session request received:', {
    body: req.body,
    hasApiKey: !!process.env.OPENAI_API_KEY
  });

  const openaiKey = process.env.OPENAI_API_KEY;

  // Validate API key exists
  if (!openaiKey) {
    console.error('OPENAI_API_KEY not configured');
    return res.status(500).json({
      error: 'OPENAI_API_KEY not configured on server'
    });
  }

  try {
    // Call OpenAI ChatKit session API
    console.log('Calling OpenAI ChatKit API...');
    
    const response = await fetch('https://api.openai.com/v1/chatkit/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
        'OpenAI-Beta': 'chatkit_beta=v1'
      },
      body: JSON.stringify({
        workflow: {
          id: WORKFLOW_ID,
          version: WORKFLOW_VERSION
        },
        user: {
          id: req.body.userId || 'anonymous'
        }
      })
    });

    const data = await response.json();

    console.log('OpenAI ChatKit API response:', {
      status: response.status,
      ok: response.ok,
      hasClientSecret: !!data.client_secret
    });

    // Handle API errors
    if (!response.ok) {
      console.error('OpenAI ChatKit API Error:', {
        status: response.status,
        error: data
      });
      return res.status(response.status).json({
        error: data.error?.message || data.error || 'Failed to create ChatKit session',
        details: data
      });
    }

    // Validate response has client_secret
    if (!data.client_secret) {
      console.error('Invalid ChatKit response - missing client_secret:', data);
      return res.status(500).json({
        error: 'Invalid response from ChatKit API - missing client_secret'
      });
    }

    console.log('ChatKit session created successfully');

    // Return only the client_secret to frontend
    res.json({
      client_secret: data.client_secret
    });

  } catch (error) {
    console.error('ChatKit session creation error:', {
      message: error.message,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Internal server error creating ChatKit session',
      message: error.message
    });
  }
});

module.exports = router;
