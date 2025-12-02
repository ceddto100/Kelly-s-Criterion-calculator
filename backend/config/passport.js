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
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value;
          console.log('=== Google OAuth Login Attempt ===');
          console.log('Google ID:', googleId);
          console.log('Email:', email);

          // Find or create user in database
          let user = await User.findOne({ identifier: googleId });

          if (!user) {
            console.log('User not found in database, creating new user...');
            try {
              // Create new user with default bankroll
              user = await User.create({
                identifier: googleId,
                currentBankroll: 1000, // Default bankroll
                tokens: 0,
                dailyCalculations: 0,
                totalCalculations: 0,
                isPremium: false
              });
              console.log('✓ User created successfully:', user._id);
            } catch (createError) {
              console.error('✗ Error creating user:', {
                message: createError.message,
                code: createError.code,
                name: createError.name
              });

              // Handle duplicate key error (race condition)
              if (createError.code === 11000) {
                console.log('Duplicate key error detected. Attempting to find existing user...');
                user = await User.findOne({ identifier: googleId });
                if (!user) {
                  console.error('CRITICAL ERROR: User not found after duplicate key error!');
                  console.log('Searching for similar users...');
                  const allUsers = await User.find({}).limit(5).select('identifier _id');
                  console.log('Recent users:', JSON.stringify(allUsers, null, 2));
                  throw new Error('Failed to create or find user after duplicate key error');
                }
                console.log('✓ Found existing user after duplicate key error:', user._id);
              } else {
                console.error('Non-duplicate key error. Details:', createError);
                throw createError;
              }
            }
          } else {
            console.log('✓ Existing user found:', user._id);
            // Update last active timestamp
            user.lastActive = new Date();
            await user.save();
          }

          // Return user object with Google profile info for session
          const sessionUser = {
            _id: user._id,
            googleId: googleId,
            name: profile.displayName,
            email: email,
            avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null
          };

          console.log('✓ Login successful for:', email);
          console.log('==================================');
          return done(null, sessionUser);
        } catch (error) {
          console.error('✗ FATAL ERROR in Google OAuth strategy:', error);
          console.log('==================================');
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
