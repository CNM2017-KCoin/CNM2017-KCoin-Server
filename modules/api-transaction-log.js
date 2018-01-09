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

exports.getLogTransaction = function (req, res) {
  let params = req.body || {};
  let email = params['email'] || '';
  let offset = params['offset'] || 0;
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
          `SELECT COUNT (id) as total
          FROM tb_transaction_log`,
          []
        ).then(
          function (transactionLogTotal) {
            dbHelper.dbLoadSql(
              `SELECT *
              FROM tb_transaction_log
              ORDER BY created_at DESC
              LIMIT ?
              OFFSET ?`,
              [
                10,
                offset * 10
              ]
            ).then(
              function (transactionLogList) {
                let data = {
                  'status': 200,
                  'report': 'Lấy dữ liệu thành công!',
                  'total': transactionLogTotal[0]['total'],
                  'data': transactionLogList,
                  'limit': 10,
                  'offset': offset
                };
                res.send(data);
              }
            );
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