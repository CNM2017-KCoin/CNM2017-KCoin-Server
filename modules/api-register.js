let dbHelper = require('../helpers/db-helper');

exports.register = function (req, res) {
  let params = req.body || {};
  console.log(req.body);
  let email = params['email'] || '';
  let password = params['password'] || '';
  if (email == '' || password == '') {
    let data = {
      'status': '500',
      'data': {
        'error': 'Vui lòng gửi email, mật khẩu...!'
      }
    };
    res.send(data);
  } else {
    dbHelper.dbLoadSql(
      `SELECT COUNT(id) AS total 
      FROM tb_login l
      WHERE l.email = ?`,
      [
        email
      ]
    ).then(
      function (Total) {
        console.log(Total);
        if (Total[0]['total']) {
          let data = {
            'status': '500',
            'data': {
              'error': 'Đã tồn tại user này...!'
            }
          };
          res.send(data);
        } else {
          dbHelper.dbLoadSql(
            `INSERT INTO tb_login (
            email, 
            password)
            VALUES (?, ?)`,
            [
              email,
              password
            ]
          ).then(
            function (userInfo) {
              let data = {
                'status': '200',
                'data': {
                  'report': 'Đăng ký thành công...!'
                }
              };
              res.send(data);
            }
          ).catch(function (error) {
              res.send(error);
            }
          );
        }
      }
    );
  }
};

