let dbHelper = require('../helpers/db-helper');

exports.getOutputData = function (req, res) {
  let params = req.body || {};
  let email = params['email'] || '';
  let offset = params['offset'] || '';
  let sender_data = [];
  dbHelper.dbLoadSql(
    `SELECT l.id, l.role 
    FROM tb_login l
    WHERE l.email = ?`,
    [
      email
    ]
  ).then(
    function (userInfo) {
      if (userInfo[0]['id'] > 0) {
        dbHelper.dbLoadSql(
          `SELECT COUNT(t.id) as total_send
          FROM tb_transaction t
          LEFT JOIN tb_transaction_input ti ON t.id = ti.transaction_id
          WHERE ti.user_id = ?`,
          [
            userInfo[0]['id']
          ]
        ).then(
          function (TotalSend) {
            if (TotalSend[0]['total_send'] == 0) {
              let data = {
                'status': 200,
                'error': 'Không tồn tại dữ liệu!',
                'data': {
                  'total_sender_trans': 0,
                  'sender_trans': [],
                  'limit': 10,
                  'offset': offset
                }
              };
              res.send(data);
            }
            dbHelper.dbLoadSql(
              `SELECT t.id, t.created_at, t.send_amount, t.status
              FROM tb_transaction t
              LEFT JOIN tb_transaction_input ti ON t.id = ti.transaction_id
              WHERE ti.user_id = ?
              LIMIT ?
              OFFSET ?`,
              [
                userInfo[0]['id'],
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
                      'total_sender_trans': TotalSend[0]['total_send'],
                      'sender_trans': [],
                      'limit': 10,
                      'offset': offset
                    }
                  };
                  res.send(data);
                }
                //, t.created_at, t.send_amount, t.status
                let test = 0;
                for (let i = 0; i < transactionIdList.length; i++) {
                  console.log('id: '+transactionIdList[i].id);
                  dbHelper.dbLoadSql(
                    `SELECT tto.user_id, tto.address
                    FROM tb_transaction_output tto
                    WHERE tto.transaction_id = ?`,
                    [
                      transactionIdList[i]['id']
                    ]
                  ).then(
                    function (outputInfo) {
                      let temp = {
                        'transaction_id': transactionIdList[i]['id'],
                        'timestamp': transactionIdList[0]['created_at'],
                        'amount': transactionIdList[0]['send_amount'],
                        'status': transactionIdList[0]['status'],
                        'receiver_id': outputInfo[0]['user_id'],
                        'receiver_address': outputInfo[0]['address'],
                      };
                      sender_data.push(temp);
                      console.log('11111111'+ sender_data.length);
                      console.log('22222222'+ TotalSend[0]['total_send']);
                      if ((sender_data.length == TotalSend[0]['total_send'])) {
                        let data = {
                          'status': 200,
                          'report': 'Lấy dữ liệu thành công!',
                          'data': {
                            'total_sender_trans': TotalSend[0]['total_send'],
                            'sender_trans': sender_data,
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

