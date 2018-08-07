module.exports = function(passport, hasher, conn, s3, app){
  var router = require('express').Router();

  // 회원가입 관련
  router.post('/addUser', (req, res) => {
    hasher({
      password: req.body.password
    }, function(err, pass, salt, hash) {
      var user = {
        'authId': 'locals:' + req.body.username,
        'username': req.body.username,
        'password': hash,
        'salt': salt,
        'displayName': req.body.displayName
      }

      var sql = "INSERT INTO users SET ?";
      conn.query(sql, user, function(err, results) {
        if (err) {
          console.log(err);
          res.redirect('/auth/login');
        } else {
          var temp = new Date();
          var date = temp.toFormat('YYYY-MM-DD HH24:MI:SS');
          var newFolder={
            title: 'file',
            user: user.id,
            createTime: date,
            updateTime: date,
            dir: '/file',
            pDir: '',
          }

          var sql = "INSERT INTO folder SET ?";
          conn.query(sql, newFolder, function(err, results) {
            if (err) {
              console.log(err);
            } else {
              s3.addUser(user.username);
            }
          });

          req.login(user, function(err) {
            req.session.save(function() {
              res.redirect('/');
            })
          })
        }
      });

    });

  });

  // 로그인/로그아웃 관련
  router.get('/login', (req, res) => {
    console.log(req.flash('error'));
    res.render('login');
  });

  router.post('/login', passport.authenticate(
    'local', {
      successRedirect: '/',
      failureRedirect: '/auth/login',
      failureFlash: true,
    }
  ));

  router.get('/facebook', passport.authenticate('facebook',
    {scope:'email'}
    )
  );

  router.get('/facebook/callback', passport.authenticate(
      'facebook', {
        failureRedirect: '/auth/login'
      }
    ),
    function(req, res) {
      req.session.save(function() {
        res.redirect('/')
      })
    }
  );

  router.get('/logout', (req, res) => {
    req.logout();
    req.session.save(function() {
      res.redirect('/');
    })
  });

  return router;
}
