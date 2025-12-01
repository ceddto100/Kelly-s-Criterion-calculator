// routes/auth.js - Google OAuth Authentication Routes
const express = require('express');
const passport = require('passport');
const router = express.Router();

/**
 * Authentication Routes for Google OAuth 2.0
 *
 * Flow:
 * 1. User clicks "Sign in with Google" → redirects to /auth/google
 * 2. User authenticates with Google → Google redirects to /auth/google/callback
 * 3. On success → user is logged in and redirected to /dashboard
 * 4. On failure → user is redirected to /login (or home page)
 * 5. User can logout via /auth/logout
 */

// ==================== INITIATE GOOGLE LOGIN ====================
/**
 * GET /auth/google
 * Initiates the Google OAuth flow
 * Redirects user to Google's login page
 */
router.get('/google',
  passport.authenticate('google', {
    scope: ['profile', 'email']
  })
);

// ==================== GOOGLE CALLBACK ====================
/**
 * GET /auth/google/callback
 * Google redirects here after user authenticates
 * This is the redirect URI set in Google Cloud Console
 */
router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: 'https://betgistics.com',
    failureMessage: true
  }),
  (req, res) => {
    // Successful authentication
    // Redirect to frontend
    res.redirect('https://betgistics.com');
  }
);

// ==================== LOGOUT ====================
/**
 * GET /auth/logout
 * Logs out the user and destroys the session
 */
router.get('/logout', (req, res, next) => {
  // Passport 0.6+ uses req.logout with a callback
  req.logout((err) => {
    if (err) {
      return next(err);
    }

    // Destroy the session
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
      }

      // Clear the session cookie
      res.clearCookie('connect.sid');

      // Redirect to frontend
      res.redirect('https://betgistics.com');
    });
  });
});

// ==================== CHECK AUTH STATUS (API) ====================
/**
 * GET /auth/status
 * Returns the current authentication status
 * Useful for frontend to check if user is logged in
 */
router.get('/status', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      authenticated: true,
      user: {
        name: req.user.name,
        email: req.user.email,
        avatar: req.user.avatar
      }
    });
  } else {
    res.json({
      authenticated: false,
      user: null
    });
  }
});

module.exports = router;
