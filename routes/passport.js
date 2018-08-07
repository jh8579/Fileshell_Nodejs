module.exports = function(app, conn, hasher){
  var passport = require('passport')
  var LocalStrategy = require('passport-local').Strategy;
  var FacebookStrategy = require('passport-facebook').Strategy;
  var flash = require('connect-flash');

  app.use(flash());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser(function(user, done) {
    return done(null, user.authId);
  });
  passport.deserializeUser(function(id, done) {
    var sql = "SELECT * FROM users WHERE authId=?";
    conn.query(sql, [id], function(err, results) {
      var user = results[0];
      return done(null, user);
    });
  });
  passport.use(new LocalStrategy(
    function(username, password, done) {
      var uname = username;
      var pwd = password;

      var sql = "SELECT * FROM users WHERE authId=?";
      conn.query(sql, ['locals:' + uname], function(err, results) {
        if (err) {
          return done(null, false, {
            message: "Incorrect Username"
          });
        }
        var user = results[0];
        if (!user) {
          return done(null, false, {
            message: "Incorrect Username"
          });
        }
        console.log(user);
        return hasher({
            password: pwd,
            salt: user.salt
          },
          function(err, pass, salt, hash) {
            if (hash === user.password) {
              done(null, user);
            } else {
              done(null, false, {
                message: "Incorrect Password"
              });
            }
          });

      });
    }
  ));
  passport.use(new FacebookStrategy({
      clientID: '513867469033293',
      clientSecret: '851751c0198d6fd80e6a0678fe80cfdc',
      callbackURL: '/auth/facebook/callback',
      profileFields:['id', 'email', 'displayName']
    },
    function(accessToken, refreshToken, profile, done) {
      var authId = 'facebook:' + profile.id;

      var user = {
        'authId': authId,
        'displayName': profile.displayName,
        'username': profile.emails[0].value
      }
      var sql = "INSERT IGNORE users SET ?";
      conn.query(sql, [user], function(err, results) {
        if (err) {
          console.log(err);
          done(null, false, {
            message: "Incorrect User"
          });
        }

        var sql = "SELECT * from users WHERE authId= ?";
        conn.query(sql, [authId], function(err, results) {
          if(err){
            console.log(err);
            done(null, false, {
              message: "Incorrect User"
            });
          }else{
            var temp = new Date();
            var date = temp.toFormat('YYYY-MM-DD HH24:MI:SS');

            var userId = results[0].id;
            var newFolder={
              title: 'file',
              user: userId,
              dir: '/file',
              createTime: date,
              updateTime: date,
              pDir: '',
              authId: ''
            }

            var sql = "INSERT IGNORE folder SET ?";
            conn.query(sql, newFolder, function(err, results) {
              if (err) {
                done(null, false, {
                  message: "Incorrect User"
                });
              } else {
                s3.addUser(user.username);
                return done(null, user);
              }
            });

          }
        });


      });
    }
  ));

  return passport;
}
