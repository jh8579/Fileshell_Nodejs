var http = require('http');
var url = require('url');

var async = require('async');

require('date-utils');

var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var fs = require('fs');
var s3 = require('./s3.js');

// session
var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);

// password
var bkfd2Password = require('pbkdf2-password');
var hasher = bkfd2Password();

// file upload
var multer = require('multer');
var memoryStorage = multer.memoryStorage();
var upload = multer({storage : memoryStorage});

// db connect
var mysql = require('mysql');
var conn = mysql.createConnection({
  host     : process.env.RDS_HOSTNAME,
  user     : process.env.RDS_USERNAME,
  password : process.env.RDS_PASSWORD,
  port     : process.env.RDS_PORT,
  database : 'innodb',
  multipleStatements: true
});
// var conn = mysql.createConnection({
//   host: 'localhost',
//   user: 'root',
//   password: 'dkfkq486',
//   database: 'fileshell',
//   multipleStatements: true

conn.connect(function(err) {
  if (err) {
    console.error('Database connection failed: ' + err.stack);
    return;
  }

  console.log('Connected to database.');
});

// passport.js
var passport = require('passport')
var LocalStrategy = require('passport-local').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var flash = require('connect-flash');

var app = express();

app.set('port', process.env.PORT || 3000);
// ejs 설정
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.engine('ejs', require('express-ejs-extend'));

// static 파일
app.use(express.static('public'));

// post body 설정
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(bodyParser.json());


// 쿠키 설정
app.use(cookieParser('shitthefuuuuuck'));

// 세션 설정
app.use(session({
  secret: 'shitthefuuuuuck',
  resave: false,
  saveUninitialized: true,
  store: new MySQLStore({
    host     : process.env.RDS_HOSTNAME,
    user     : process.env.RDS_USERNAME,
    password : process.env.RDS_PASSWORD,
    port     : process.env.RDS_PORT,
    database : 'innodb',
  })
}))

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

// 홈 관련
app.get('/', (req, res) => {
  if (req.user) {
    var userId = req.user.id;
    var sql = "SELECT * FROM folder WHERE isFavor=1 AND user=?;" + "SELECT * FROM file WHERE isFavor=1 AND user=?;" + "SELECT * FROM folder WHERE updateTime=0 AND user=?;" + "SELECT * FROM file WHERE updateTime=0 AND user=?;"
    conn.query(sql, [userId, userId, userId, userId], function(err, results) {
      res.render('index', {
        userId: req.user.displayName,
        favorFolders: results[0],
        favorFiles: results[1],
        recentFolders:results[2],
        recentFiles: results[3]
      });
    });
  } else {
    res.redirect('/auth/login');
  }
});

// 회원가입 관련
app.post('/addUser', (req, res) => {
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
app.get('/auth/login', (req, res) => {
  console.log(req.flash('error'));
  res.render('login');
});

app.post('/auth/login', passport.authenticate(
  'local', {
    successRedirect: '/',
    failureRedirect: '/auth/login',
    failureFlash: true,
  }
));

app.get('/auth/facebook', passport.authenticate('facebook',
  {scope:'email'}
  )
);

app.get('/auth/facebook/callback', passport.authenticate(
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

app.get('/logout', (req, res) => {
  req.logout();
  req.session.save(function() {
    res.redirect('/');
  })
});

// 검색 관련
app.get('/search', (req, res) => {
  var userId = req.user.id;
  var query = req.query.query;

  var sql = "SELECT * FROM folder WHERE title LIKE ? AND user= ?;";
  sql += "SELECT * FROM file WHERE title LIKE ? AND user= ?;";
  conn.query(sql, [query + "%", userId, query + "%", userId], function(err, rows, fields) {
    if (err) {
      console.log(err);
    }
    res.render('search', {
      title: "Search page",
      folderList: rows[0],
      fileList: rows[1],
    });
  });
});

// 파일 관련
app.get('/file*', (req, res) => {
  var userId = req.user.id;
  var dir = req.url;
  var folderList, fileList;

  var sql = "SELECT * FROM folder WHERE pDir= ? AND user= ?;";
  sql += "SELECT * FROM file WHERE dir= ? AND user= ?;";
  conn.query(sql, [dir, userId, dir, userId], function(err, rows, fields) {
    if (err) {
      console.log(err);
    }
    res.render('file', {
      folderList: rows[0],
      fileList: rows[1]
    });
  });
});

app.post('/upload', upload.array('file'), (req, res) => {
  var dir = url.parse(req.headers.referer);
  var fileDir = dir.pathname;

  async.parallel([
    function(){
      req.files.forEach(function(fileObj, index){
      var temp = new Date();
      var date = temp.toFormat('YYYY-MM-DD HH24:MI:SS');
      var s3Dir = req.user.username +  dir.pathname + '/' +fileObj.originalname;

      var sql = "Select * from folder WHERE dir= ?";
      conn.query(sql, dir.pathname, function(err, results) {
        if (err) {
          console.log(err);
        } else {
          var folderId = results[0].id;
          var newFile = {
            user: req.user.id,
            title: fileObj.originalname,
            type: fileObj.mimetype,
            size: sizeCheck(fileObj.size),
            createTime: date,
            updateTime: date,
            dir: fileDir,
            s3Dir: s3Dir,
            folderId: folderId
          }

          var sql = "INSERT INTO file SET ?";
          conn.query(sql, newFile, function(err, results) {
            if (err) {
              console.log(err);
            } else {
              s3.addFile(fileObj.buffer, s3Dir);
            }
          });
        }
      });
    })
  }]);
  res.redirect(req.headers.referer);
});

app.get('/download/:fileId', (req, res) => {
  var user = req.user.id;
  var fileId = req.params.fileId;

  async.parallel([
    function(){
      var sql = "SELECT * FROM file WHERE id=? AND user=?;";
      conn.query(sql, [fileId, user], function(err, rows, fields) {
        if (err) {
          console.log(err);
        }
        var dir = rows[0].s3Dir;
        var url = s3.downloadFile(dir, res);

      });
    }
  ])
})

app.get('/deleteFile/:fileId', (req, res) => {
  var user = req.user.id;
  var fileId = req.params.fileId;

  var sql = "SELECT * FROM file WHERE id=? AND user=?;"
  sql += "DELETE FROM file WHERE id=? AND user=?;";
  conn.query(sql, [fileId, user, fileId, user], function(err, rows, fields) {
    if (err) {
      console.log(err);
    }
    var s3Dir = rows[0][0].s3Dir;
    s3.deleteFile(s3Dir);
    res.redirect(req.headers.referer);
  });

})

app.get('/deleteFolder/:folderId', (req, res) => {
  var user = req.user.id;
  var folderId = req.params.folderId;

  var sql = "SELECT * FROM folder WHERE id=? AND user=?;"
  sql += "DELETE FROM folder WHERE id=? AND user=?;";
  conn.query(sql, [folderId, user, folderId, user], function(err, rows, fields) {
    if (err) {
      console.log(err);
    }
    var s3Dir = req.user.username +rows[0][0].dir;
    s3.deleteFolder(s3Dir);
    res.redirect(req.headers.referer);
  });
})

app.post('/addFolder', function(req, res){
  var dir = url.parse(req.headers.referer);
  var title = req.body.title;
  var folderDir = dir.pathname + '/' + title;
  var temp = new Date();
  var date = temp.toFormat('YYYY-MM-DD HH24:MI:SS');

  var sql = "Select * from folder WHERE dir= ?";
  conn.query(sql, dir.pathname, function(err, results) {
    if (err) {
      console.log(err);
    } else {
      var parentFolderId = results[0].id;
      var newFolder={
        title: title,
        user: req.user.id,
        createTime: date,
        updateTime: date,
        dir: folderDir,
        pDir: dir.pathname,
        parentFolderId: parentFolderId
      }

      var sql = "INSERT INTO folder SET ?";
      conn.query(sql, newFolder, function(err, results) {
        if (err) {
          console.log(err);
        } else {
          s3.addFolder(req.user.username, folderDir + '/');
          res.redirect(dir.pathname);
        }
      });

    }
  });


})

app.get('/changeFavor/:type/:title', function(req, res){
  var title = req.params.title;
  var type = req.params.type;
  var userId = req.user.id;

  var sql = "UPDATE " + type +" SET isFavor=IF(isFavor=1,0,1) WHERE title=? AND user= ?;";
  conn.query(sql, [title, userId], function(err, results) {
    if (err) {
      console.log(err);
    } else {
      res.redirect(req.headers.referer);
    }
  });

})

// 서버 실행
http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

function sizeCheck(size){
  console.log(size);
  var newSize;
  if((size/1024) < 1){
    return newSize = size + 'B';
  }else if((size/1048576) < 1){
    return newSize = size/1024 + 'KB';
  }else if((size/1073741824) < 1){
    return newSize = size/(1048576) + 'MB';
  }else if((size/1073741824) > 1){
    return newSize = size/(1073741824) + 'GB';
  }
}
