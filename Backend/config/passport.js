const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL}/api/auth/google/callback`,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
          if (!user.googleId) {
            user.googleId = profile.id;
            user.isVerified = true;
            await user.save();
          }
          return done(null, user);
        }

        const nameParts = profile.displayName.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || '';

        user = await User.create({
          firstName,
          lastName,
          email: profile.emails[0].value,
          googleId: profile.id,
          isVerified: true,
          password: null,
        });

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);