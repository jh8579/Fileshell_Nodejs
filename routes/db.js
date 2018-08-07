  // db connect
  // var mysql = require('mysql');
  // var conn = mysql.createConnection({
  //   host     : process.env.RDS_HOSTNAME,
  //   user     : process.env.RDS_USERNAME,
  //   password : process.env.RDS_PASSWORD,
  //   port     : process.env.RDS_PORT,
  //   database : 'innodb',
  //   multipleStatements: true
  // });

  var mysql = require('mysql');
  var conn = mysql.createConnection({
    host     : 'localhost',
    user     : 'root',
    password : 'dkfkq486',
    port     : 3306,
    database : 'fileshell',
    multipleStatements: true
  });

  conn.connect(function(err) {
    if (err) {
      console.error('Database connection failed: ' + err.stack);
      return;
    }

    console.log('Connected to database.');
  });
  
module.exports = conn;
