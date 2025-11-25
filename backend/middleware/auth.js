// middleware/auth.js - Authentication Middleware

/**
 * Middleware to ensure user is authenticated before accessing a route
 * Uses Passport's req.isAuthenticated() method
 *
 * Usage:
 *   app.get('/dashboard', ensureAuthenticated, (req, res) => {
 *     // This code only runs if user is authenticated
 *     res.json({ user: req.user });
 *   });
 */
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    // User is authenticated, proceed to next middleware/route handler
    return next();
  }

  // User is not authenticated
  // For API routes, return 401 JSON response
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'You must be logged in to access this resource'
    });
  }

  // For regular routes, redirect to home page
  res.redirect('/');
}

/**
 * Middleware to check if user is already authenticated
 * Useful for login/signup pages that shouldn't be accessible when logged in
 *
 * Usage:
 *   app.get('/login', ensureNotAuthenticated, (req, res) => {
 *     res.render('login');
 *   });
 */
function ensureNotAuthenticated(req, res, next) {
  if (!req.isAuthenticated()) {
    return next();
  }

  // User is already logged in, redirect to dashboard
  res.redirect('/dashboard');
}

module.exports = {
  ensureAuthenticated,
  ensureNotAuthenticated
};
