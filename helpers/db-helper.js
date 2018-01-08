let Mysql = require('node-mysql-helper');
let Q = require('q');

let mysqlOptions = {
  host: 'sql12.freemysqlhosting.net',
  user: 'sql12213542',
  password: 'UXjQaxJ2xf',
  database: 'sql12213542',
  /*host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'db_kcoin',*/
  socketPath: false,
  connectionLimit: 5
};

//For 5 pooled connections
Mysql.connect(mysqlOptions);

exports.dbQuery = function (sql, params, funcSuccess, funcError) {
  Mysql.query(sql, params).then(
    function (response) {
      funcSuccess(response);
    }
  ).catch(
    function (error) {
      funcError(error);
    }
  );
}

exports.dbLoadSql = function (sql, params) {
  var deferred = Q.defer();
  Mysql.query(sql, params).then(
    function (rows) {
      deferred.resolve(rows);
    }
  )
  return deferred.promise;
}