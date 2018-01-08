let dbHelper = require('../helpers/db-helper');

exports.getInputData = function (req, res) {
  let params = req.body || {};
  let email = params['email'] || '';
  let offset = params['offset'] || '';
  dbHelper.dbLoadSql(
    `SELECT l.id, l.role, l.address 
    FROM tb_login l
    WHERE l.email = ?`,
    [
      email
    ]
  ).then(
    function (userInfo) {
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
              `SELECT t.id, t.created_at, t.send_amount, t.status
              FROM tb_transaction t
              LEFT JOIN tb_transaction_output tto ON t.id = tto.transaction_id
              WHERE tto.user_id = ?
              AND t.status = ?
              LIMIT ?
              OFFSET ?
              ORDER BY t.created_at DESC`,
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
                for (let i = 0; i < transactionIdList.length; i++) {
                  dbHelper.dbLoadSql(
                    `SELECT ti.user_id, ti.address, ti.ref_hash, ti.ref_index
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
                        'amount': transactionIdList[i]['send_amount'],
                        'status': transactionIdList[i]['status'],
                        'sender_id': inputInfo[0]['user_id'],
                        'sender_address': inputInfo[0]['address'],
                        'ref_hash': inputInfo[0]['ref_hash'],
                        'ref_index': inputInfo[0]['ref_index'],
                      };
                      receiver_data.push(temp);
                      if (receiver_data.length == TotalReceive[0]['total_receive']) {
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
                  );
                }
              }
            );
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

