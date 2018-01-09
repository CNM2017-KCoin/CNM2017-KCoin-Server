let dbHelper = require('../helpers/db-helper');

exports.saveLogTransaction = function (req, res) {
  let params = req || {};
  let email = params['email'] || '';
  let transactionId = params['transaction_id'] || '';
  let actionText = params['action'] || '';
  let password = params['password'] || '';
  dbHelper.dbLoadSql(
    `SELECT id, role, status 
    FROM tb_login l
    WHERE l.email = ?`,
    [
      email,
      // 1
    ]
  ).then(
    function (userInfo) {
      if (userInfo[0]['id'] > 0) {
        dbHelper.dbLoadSql(
          `INSERT INTO tb_transaction_log (
            transaction_id, 
            user_id,
            action)
            VALUES (?, ?, ?)`,
          [
            transactionId,
            userInfo[0]['id'],
            actionText
          ]
        ).then(
          function (transactionLogInfo) {
            if (transactionLogInfo.insertId > 0) {
              // do nothing
            }
          }
        );
      } else {
        let data = {
          'status': '500',
          'data': {
            'error': 'Tài khoản không thuộc hệ thống hoặc chưa được kích hoạt!'
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

