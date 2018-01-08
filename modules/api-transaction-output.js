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
      console.log(userInfo[0]['id']);
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
              `SELECT t.id, t.created_at, t.send_amount, t.status
              FROM tb_transaction t
              LEFT JOIN tb_transaction_input ti ON t.id = ti.transaction_id
              WHERE ti.user_id = ?`,
              [
                userInfo[0]['id']
              ]
            ).then(
              function (sendInfo) {
                console.log('length: ' + sendInfo.length);
                let sender_data = [];
                for (let i = 0; i < sendInfo.length; i++) {
                  console.log(0);
                  dbHelper.dbLoadSql(
                    `SELECT tto.user_id, tto.address
                    FROM tb_transaction_output tto
                    WHERE tto.transaction_id = ?`,
                    [
                      sendInfo[i]['id']
                    ]
                  ).then(
                    function (outputInfo) {
                      console.log('1');
                      let temp = {
                        'transaction_id': sendInfo[i]['id'],
                        'timestamp': sendInfo[i]['created_at'],
                        'amount': sendInfo[i]['send_amount'],
                        'status': sendInfo[i]['status'],
                        'receiver_id': outputInfo['id'],
                        'receiver_address': outputInfo['address'],
                      };
                      sender_data.push(temp);
                      if (i == sendInfo.length - 1) {
                        console.log('yeah!!!');
                        let data = {
                          'total_sender_trans': TotalSend[0]['total_send'],
                          'sender_trans': sender_data
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
  );
};