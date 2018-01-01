let dbHelper = require('../helpers/db-helper');

exports.test = function (req, res) {
  dbHelper.dbLoadSql(
    `SELECT id 
    FROM test`,
    []
  ).then(
    function (test) {
      let data = {
        'status': '1',
        'data': []
      };

      res.send(data);
    }
  ).catch(function (error) {
      let data = {
        'status': '0',
        'data': []
      };
      res.send(data);
    }
  );
};

