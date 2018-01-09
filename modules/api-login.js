let dbHelper = require('../helpers/db-helper');

exports.login = function (req, res) {
  let params = req.body || {};
  let email = params['email'] || '';
  let password = params['password'] || '';
  dbHelper.dbLoadSql(
    `SELECT id,role, status 
    FROM tb_login l
    WHERE l.email = ?
    AND l.password = ?`,
    [
      email,
      password
    ]
  ).then(
    function (userInfo) {
      let data = [];
      if (userInfo[0]['id'] > 0) {
        if(userInfo[0]['status'] == 0) {
          let data = {
            'status': '400',
            'data': {
              'error': 'Chưa xác nhận email!'
            }
          };
          res.send(data);
        } else {
          let data = {
            'status': '200',
            'data': {
              'role':userInfo[0]['role'],
              'report': 'Đăng nhập thành công!'
            }
          };
          res.send(data);
        } 
      } else {
        let data = {
          'status': '500',
          'data': {
            'error': 'Đăng nhập thất bại!'
          }
        };
        res.send(data);
      }
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

