// config/passport.js - Passport Google OAuth 2.0 Configuration
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { User } = require('./database');

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
        callbackURL: 'https://api.betgistics.com/auth/google/callback',
        // Request user profile and email
        scope: ['profile', 'email']
      },
      // Verify callback - called after successful Google authentication
      async function(accessToken, refreshToken, profile, done) {
        try {
          // Find or create user in database
          let dbUser = await User.findOne({ identifier: profile.id });

          if (!dbUser) {
            try {
              // Create new user with default bankroll
              dbUser = await User.create({
                identifier: profile.id,
                currentBankroll: 1000,
                tokens: 0,
                dailyCalculations: 0,
                totalCalculations: 0,
                isPremium: false
              });
            } catch (createError) {
              // Handle duplicate key error (race condition)
              if (createError.code === 11000) {
                dbUser = await User.findOne({ identifier: profile.id });
                if (!dbUser) {
                  throw new Error('Failed to create or find user');
                }
              } else {
                throw createError;
              }
            }
          } else {
            // Update last active timestamp
            dbUser.lastActive = new Date();
            await dbUser.save();
          }

          // Return session user with Google profile info
          const sessionUser = {
            _id: dbUser._id,
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails && profile.emails[0] ? profile.emails[0].value : null,
            avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null
          };

          return done(null, sessionUser);
        } catch (error) {
          console.error('Error in Google OAuth strategy:', error);
          return done(error, null);
        }
      }
    )
  );

  // ==================== SERIALIZE USER ====================
  // Determines what data to store in the session
  passport.serializeUser((user, done) => {
    done(null, user);
  });

  // ==================== DESERIALIZE USER ====================
  // Retrieves the full user object from the session data
  passport.deserializeUser((user, done) => {
    done(null, user);
  });
};
