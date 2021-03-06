let dbHelper = require('../helpers/db-helper');

exports.getInputData = function (req, res) {
  let params = req.body || {};
  let email = params['email'] || '';
  let password = params['password'] || '';
  let offset = params['offset'] || '';
  dbHelper.dbLoadSql(
    `SELECT l.id, l.role, l.address 
    FROM tb_login l
    WHERE l.email = ?
    AND l.password = ?`,
    [
      email,
      password
    ]
  ).then(
    function (userInfo) {
      if (userInfo.length < 1 || userInfo[0]['status'] == 0) {
        let data = {
          'status': '500',
          'data': {
            'error': 'Bạn không có quyền truy cập!'
          }
        };
        res.send(data);
      }
      if (userInfo[0]['id'] > 0) {
        dbHelper.dbLoadSql(
          `SELECT COUNT(t.id) as total_receive
          FROM tb_transaction t
          LEFT JOIN tb_transaction_output tto ON t.id = tto.transaction_id
          WHERE tto.user_id = ?
          AND t.status = ?`,
          [
            userInfo[0]['id'],
            'success'
          ]
        ).then(
          function (TotalReceive) {
            if (TotalReceive[0]['total_receive'] == 0) {
              let data = {
                'status': 200,
                'error': 'Không tồn tại dữ liệu ',
                'data': {
                  'total_receiver_trans': 0,
                  'receiver_trans': [],
                  'limit': 10,
                  'offset': offset
                }
              };
              res.send(data);
            }
            dbHelper.dbLoadSql(
              `SELECT t.id, t.created_at, t.send_amount, t.status, tto.amount, tto.ref_index
              FROM tb_transaction t
              LEFT JOIN tb_transaction_output tto ON t.id = tto.transaction_id
              WHERE tto.user_id = ?
              AND t.status = ?
              ORDER BY t.created_at DESC
              LIMIT ?
              OFFSET ?`,
              [
                userInfo[0]['id'],
                'success',
                10,
                offset * 10
              ]
            ).then(
              function (transactionIdList) {
                if (transactionIdList.length == 0) {
                  let data = {
                    'status': 200,
                    'error': 'Không tồn tại dữ liệu phân trang này',
                    'data': {
                      'total_receiver_trans': 0,
                      'receiver_trans': [],
                      'limit': 10,
                      'offset': offset
                    }
                  };
                  res.send(data);
                }
                let receiver_data = [];
                // console.log('it is me' + transactionIdList[0]['id']);
                // console.log('it is me' + transactionIdList[1]['id']);
                let condition = transactionIdList.length;
                for (let i = 0; i < transactionIdList.length; i++) {
                  dbHelper.dbLoadSql(
                    `SELECT ti.user_id, ti.address, ti.ref_hash, ti.ref_index, ti.amount
                    FROM tb_transaction_input ti
                    WHERE ti.transaction_id = ?`,
                    [
                      transactionIdList[i]['id']
                    ]
                  ).then(
                    function (inputInfo) {
                      let temp = {
                        'transaction_id': transactionIdList[i]['id'],
                        'timestamp': transactionIdList[i]['created_at'],
                        'amount': transactionIdList[i]['amount'],
                        'status': transactionIdList[i]['status'],
                        'sender_id': inputInfo[0]['user_id'],
                        'sender_address': inputInfo[0]['address'],
                        'ref_hash': inputInfo[0]['ref_hash'],
                        'ref_index': transactionIdList[i]['ref_index'],
                      };
                      receiver_data.push(temp);
                      if (receiver_data.length == condition) {
                        receiver_data.sort(function (a, b) {
                          return b['transaction_id'] - a['transaction_id'];
                        });
                        let data = {
                          'status': 200,
                          'report': 'Lấy dữ liệu thành công!',
                          'data': {
                            'total_receiver_trans': TotalReceive[0]['total_receive'],
                            'receiver_trans': receiver_data,
                            'limit': 10,
                            'offset': offset
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

