// config/passport.js - Passport Google OAuth 2.0 Configuration
const GoogleStrategy = require('passport-google-oauth20').Strategy;

/**
 * Configure Passport with Google OAuth 2.0 Strategy
 *
 * Environment Variables Required:
 * - GOOGLE_CLIENT_ID: Your Google OAuth Client ID from Google Cloud Console
 * - GOOGLE_CLIENT_SECRET: Your Google OAuth Client Secret from Google Cloud Console
 *
 * Google Cloud Console Setup:
 * 1. Go to https://console.cloud.google.com/
 * 2. Create a new project or select existing one
 * 3. Enable Google+ API
 * 4. Create OAuth 2.0 credentials
 * 5. Add authorized redirect URI: http://localhost:3000/auth/google/callback
 *    (For production, add your production domain)
 */
module.exports = function(passport) {
  // ==================== GOOGLE OAUTH STRATEGY ====================
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: 'https://kelly-s-criterion-calculator.onrender.com/auth/google/callback',
        // Request user profile and email
        scope: ['profile', 'email']
      },
      // Verify callback - called after successful Google authentication
      async function(accessToken, refreshToken, profile, done) {
        try {
          // Extract user information from Google profile
          const user = {
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails && profile.emails[0] ? profile.emails[0].value : null,
            avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
            // Store the full profile for debugging (optional)
            _json: profile._json
          };

          // TODO: In production, you would:
          // 1. Check if user exists in database by googleId
          // 2. If exists, update their info and return existing user
          // 3. If new, create new user record in database
          //
          // Example with database integration:
          // const User = require('../models/User');
          // let dbUser = await User.findOne({ googleId: profile.id });
          // if (!dbUser) {
          //   dbUser = await User.create(user);
          // }
          // return done(null, dbUser);

          // For now, we'll just pass the user object directly
          return done(null, user);
        } catch (error) {
          return done(error, null);
        }
      }
    )
  );

  // ==================== SERIALIZE USER ====================
  // Determines what data to store in the session
  // In production, you'd typically store only the user ID
  passport.serializeUser((user, done) => {
    // For now, we serialize the entire user object since we're not using a database
    // In production with database: done(null, user.id);
    done(null, user);
  });

  // ==================== DESERIALIZE USER ====================
  // Retrieves the full user object from the session data
  passport.deserializeUser((user, done) => {
    // For now, we just return the user object directly
    // In production with database:
    // User.findById(id, (err, user) => {
    //   done(err, user);
    // });
    done(null, user);
  });
};
