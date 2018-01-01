let dbHelper = require('../helpers/db-helper');

exports.login = function (req, res) {
  let params = req.body || {};
  let email = params['email'] || '';
  let password = params['password'] || '';
  dbHelper.dbLoadSql(
    `SELECT id 
    FROM tb_login l
    WHERE l.email = ?
    AND l.password = ?`,
    [
      email,
      password
    ]
  ).then(
    function (userInfo) {
      console.log(userInfo);
      let data = [];
      if (userInfo[0]['id'] > 0) {
        data = {
          'status': '200',
          'data': {
            'report': 'Đăng nhập thành công!'
          }
        };
      } else {
        data = {
          'status': '500',
          'data': {
            'error': 'Đăng nhập thất bại!'
          }
        };
      }
      res.send(data);
    }
  ).catch(function (error) {
      let data = {
        'status': '500',
        'data': {
          'error': 'Đã có lỗi xảy ra... Vui lòng thử lại!'
        }
      };
      res.send(data);
    }
  );
};

