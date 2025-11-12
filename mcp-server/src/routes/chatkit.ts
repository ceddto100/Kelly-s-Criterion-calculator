/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ChatKit Session Route for MCP Server
 * Creates secure OpenAI ChatKit sessions and returns client secrets
 */

import { Router, Request, Response } from 'express';

const router = Router();

// ChatKit workflow configuration
const WORKFLOW_ID = "wf_6913ae8d21588190822630566a8233ca0416772e440b6b71";
const WORKFLOW_VERSION = "2";

/**
 * POST /api/chatkit/session
 * Creates a new ChatKit session and returns a client secret
 */
router.post('/session', async (req: Request, res: Response) => {
  const openaiKey = process.env.OPENAI_API_KEY;

  // Validate API key exists
  if (!openaiKey) {
    return res.status(500).json({
      error: 'OPENAI_API_KEY not configured on server'
    });
  }

  try {
    // Call OpenAI ChatKit session API
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

    // Handle API errors
    if (!response.ok) {
      console.error('OpenAI ChatKit API Error:', {
        status: response.status,
        error: data
      });
      return res.status(response.status).json({
        error: data.error || 'Failed to create ChatKit session'
      });
    }

    // Validate response has client_secret
    if (!data.client_secret) {
      console.error('Invalid ChatKit response - missing client_secret:', data);
      return res.status(500).json({
        error: 'Invalid response from ChatKit API'
      });
    }

    // Return only the client_secret to frontend
    res.json({
      client_secret: data.client_secret
    });

  } catch (error: any) {
    console.error('ChatKit session creation error:', error);
    res.status(500).json({
      error: 'Internal server error creating ChatKit session',
      message: error.message
    });
  }
});

export default router;
