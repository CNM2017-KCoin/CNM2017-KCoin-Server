let dbHelper = require('../helpers/db-helper');

exports.getOutputData = function (req, res) {
  let params = req.body || {};
  let email = params['email'] || '';
  let offset = params['offset'] || '';
  dbHelper.dbLoadSql(
    `SELECT id, role 
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
            dbHelper.dbLoadSql(
              `SELECT t.id
              FROM tb_transaction t
              LEFT JOIN tb_transaction_input ti ON t.id = ti.transaction_id
              WHERE ti.user_id = ?
              LIMIT ?
              OFFSET ?`,
              [
                userInfo[0]['id'],
                10,
                offset*10
              ]
            ).then(
              function (transactionIdList) {
                if (transactionIdList.length == 0) {
                  let data = {
                    'status': 500,
                    'error': 'Không tồn tại dữ liệu phân trang này',
                    'data': {
                      'total_sender_trans': TotalSend[0]['total_send'],
                      'sender_trans': {},
                      'limit': 10,
                      'offset': offset
                    }
                  };
                  res.send(data);
                }
                //, t.created_at, t.send_amount, t.status
                let sender_data = [];
                for (let i = 0; i < transactionIdList.length; i++) {
                  dbHelper.dbLoadSql(
                    `SELECT t.created_at, t.send_amount, t.status
                    FROM tb_transaction t
                    WHERE t.id = ?`,
                    [
                      transactionIdList[i]['id']
                    ]
                  ).then(
                    function (sendInfo) {
                      console.log('length: ' + sendInfo.length);
                      for (let j = 0; j < sendInfo.length; j++) {
                        console.log('offset: '+offset);
                        dbHelper.dbLoadSql(
                          `SELECT tto.user_id, tto.address
                          FROM tb_transaction_output tto
                          WHERE tto.transaction_id = ?`,
                          [
                            sendInfo[j]['id']
                          ]
                        ).then(
                          function (outputInfo) {
                            console.log('1');
                            let temp = {
                              'transaction_id': transactionIdList[i]['id'],
                              'timestamp': sendInfo[j]['created_at'],
                              'amount': sendInfo[j]['send_amount'],
                              'status': sendInfo[j]['status'],
                              'receiver_id': outputInfo['id'],
                              'receiver_address': outputInfo['address'],
                            };
                            sender_data.push(temp);
                            if (j == sendInfo.length - 1 && i == transactionIdList.length - 1) {
                              console.log('yeah!!!');
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
              }
            );
          }
        );
      }
    }
  );
};