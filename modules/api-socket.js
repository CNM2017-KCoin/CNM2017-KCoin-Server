const WebSocket = require('ws');
const ws = new WebSocket('wss://api.kcoin.club/');
let schedule = require('node-schedule');
let dbHelper = require('../helpers/db-helper');
let logTransaction = require('./api-transaction-log');

ws.onopen = function () {
  console.log('connected');
};

ws.onmessage = function (response) {
  let data = JSON.parse(response.data)
  // // console.log('incoming data', data);
  // console.log('Extract data', data.data);
  // // console.log('Trans data', data.data.transactions);
  let transactionServerList = data.data.transactions;
  dbHelper.dbLoadSql(
    `SELECT id, ref_hash
    FROM tb_transaction t
    WHERE t.status = ?`,
    [
      'waiting'
    ]
  ).then(
    function (transactionList) {
      dbHelper.dbLoadSql(
        `SELECT id, ref_hash, ref_index
        FROM tb_input_package ip
        WHERE ip.amount != ?`,
        [
          0
        ]
      ).then(
        function (inputPackageList) {
          dbHelper.dbLoadSql(
            `SELECT l.id, l.address, l.email
              FROM tb_login l
              WHERE l.address != ?`,
            [
              ''
            ]
          ).then(
            function (AddressList) {
              let hashServerList = [];
              let hashList = [];
              let hashChooseList = [];
              for (let i = 0; i < transactionServerList.length; i++) {
                hashServerList.push(transactionServerList[i]['hash']);
              }
              for (let i = 0; i < transactionList.length; i++) {
                hashList.push(transactionList[i]['ref_hash']);
              }
              let hashSaveList = [];
              for (let i = 0; i < hashServerList.length; i++) {
                if (hashList.includes(hashServerList[i])) {
                  hashChooseList.push(hashServerList[i]);
                } else {
                  hashSaveList.push(hashServerList[i]);
                }
              }
              console.log(transactionServerList.length);
              console.log(hashChooseList);
              for (let i = 0; i < transactionServerList.length; i++) {
                // Check in transaction of my server have hash like data of receive server data
                // => update status = success
                //  when have hash like my server
                console.log(transactionServerList[i]['hash']);
                if (hashChooseList.includes(transactionServerList[i]['hash'])){
                  let transId = 0;
                  for (let j = 0; j < transactionList.length; j++){
                    if (transactionList[j]['ref_hash'] == transactionServerList[i]['hash']){
                      transId = transactionList[j]['id'];
                    }
                  }
                  console.log('id: ' + transId);
                  dbHelper.dbLoadSql(
                    `UPDATE tb_transaction
                      SET status = ?
                      WHERE id = ?
                      AND status = ?`,
                    [
                      'success',
                      transId,
                      'waiting'
                    ]
                  ).then(
                    function (transInfo) {
                      // check in input packet of my server have ref_hash and ref_index like data of receive server data
                      // => update amount == 0
                      let inputServerList = transactionServerList[i].inputs;
                      for (let k = 0; k < inputPackageList.length; k++) {
                        for (let h = 0; h < inputServerList.length; h++) {
                          if (inputServerList[h]['referencedOutputHash'] == inputPackageList[k]['ref_hash']
                            && inputServerList[h]['referencedOutputIndex'] == inputPackageList[k]['ref_index']) {
                            dbHelper.dbLoadSql(
                              `UPDATE tb_input_package
                                SET amount = ?
                                WHERE id = ?`,
                              [
                                0,
                                inputPackageList[k]['id']
                              ]
                            ).then(
                              function (inputPackageInfo) {
                                // do nothing
                              }
                            ).catch(function (error) {
                                let data = {
                                  'status': '500',
                                  'data': {
                                    'error': "don't update tb_input_package success!!!"
                                  }
                                };
                                // console.log(data);
                              }
                            );
                          }
                        }
                      }
                      // get ref_hash, ref_index in output of reiceive server data to save on my server
                      let outputServerList = transactionServerList[i].outputs;
                      for (let k = 0; k < outputServerList.length; k++) {
                        // get user_id by address
                        dbHelper.dbLoadSql(
                          `SELECT id, email
                            FROM tb_login l
                            WHERE l.address = ?`,
                          [
                            outputServerList[k]['lockScript'].substr(4, outputServerList[k]['lockScript'].length)
                          ]
                        ).then(
                          // save data from output data to input package
                          function (userInfo) {
                            console.log('user info: ' + userInfo[0]['id']);
                            dbHelper.dbLoadSql(
                              `INSERT INTO tb_input_package (
                                user_id, 
                                ref_hash,
                                ref_index,
                                amount)
                                VALUES (?, ?, ?, ?)`,
                              [
                                userInfo[0]['id'],
                                transactionServerList[i].hash,
                                k,
                                outputServerList[k]['value']
                              ]
                            ).then(
                              function (inputPackInfo) {
                                // Count amount of input package to count actual amount
                                dbHelper.dbLoadSql(
                                  `SELECT SUM(ip.amount) as total_actual_amount
                                    FROM tb_input_package ip
                                    WHERE ip.user_id = ?
                                    AND ip.amount != ?`,
                                  [
                                    userInfo[0]['id'],
                                    0
                                  ]
                                ).then(
                                  function (actualAmountInfo) {
                                    // update actual amount on tb_wallet
                                    dbHelper.dbLoadSql(
                                      `UPDATE tb_wallet
                                        SET actual_amount = ?
                                        WHERE user_id = ?`,
                                      [
                                        actualAmountInfo[0]['total_actual_amount'],
                                        userInfo[0]['id']
                                      ]
                                    ).then(
                                      function (walletInfo) {
                                        // count send_amount from table tb_transaction and tb_transaction_input
                                        dbHelper.dbLoadSql(
                                          `SELECT SUM(t.send_amount) as total_send_amount
                                            FROM tb_transaction t
                                            LEFT JOIN tb_transaction_input ti ON t.id = ti.transaction_id
                                            WHERE t.status = ?
                                            AND ti.user_id = ?`,
                                          [
                                            'waiting',
                                            userInfo[0]['id']
                                          ]
                                        ).then(
                                          function (sendAmountInfo) {
                                            // update available amount on tb_wallet
                                            dbHelper.dbLoadSql(
                                              `UPDATE tb_wallet
                                                SET available_amount = ?
                                                WHERE user_id = ?`,
                                              [
                                                actualAmountInfo[0]['total_actual_amount'] - sendAmountInfo[0]['total_send_amount'],
                                                userInfo[0]['id']
                                              ]
                                            ).then(
                                              function (walletInfo2) {
                                                let request = {
                                                  'email': userInfo[0]['email'],
                                                  'transaction_id': transId,
                                                  'action': 'send_success'
                                                };
                                                let response = [];
                                                logTransaction.saveLogTransaction(request, response);
                                                // send mail report changed
                                                let newAvailableAmount = actualAmountInfo[0]['total_actual_amount'] - sendAmountInfo[0]['total_send_amount'];
                                                let newActualAmount = actualAmountInfo[0]['total_actual_amount'];
                                                let transporter = nodemailer.createTransport(
                                                {
                                                  service: 'Gmail',
                                                  auth: {
                                                    type: 'OAuth2',
                                                    user: "vuquangkhtn@gmail.com",
                                                    clientId: "347978303221-ae0esf1ucvud2m5g1k9csvt40bkhn2lr.apps.googleusercontent.com",
                                                    clientSecret: "pSU1AXrZRSSqayy4ulE8xiA6",
                                                    refreshToken: "1/KEih6qtYQoj4ADp49R1rMXQArsARt2dua6n2eQQ55lA"
                                                  },
                                                  tls: {
                                                    rejectUnauthorized: false
                                                  }
                                                }
                                              );
                                              // { token: '630618' } 
                                              let strContext = "<div>Dear Sir/Madam,</br> Your amounts have been changed in KCoin Wallet. Your new available amount is " + newAvailableAmount + " and actual amount is "+newActualAmount+"</div>";

                                              let mailOptions = {
                                                from: 'vuquangkhtn@gmail.com', // sender address
                                                to: email, // list of receivers
                                                subject: 'KCoin Authentication - Verify your email address', // Subject line
                                                text: 'You recieved message from ',
                                                html: strContext, // plain text body
                                              };

                                              transporter.sendMail(mailOptions, (error, info) => {
                                                  if (error) {
                                                    let data = {
                                                      'status': '500',
                                                      'data': {
                                                        'error': 'Đã có lỗi xảy ra... Vui lòng thử lại!'
                                                      }
                                                    };
                                                    console.log(data);
                                                  } else {
                                                    let data = {
                                                      'status': '200',
                                                      'data': {
                                                        'report': 'Đăng ký thành công...!'
                                                      }
                                                    };
                                                    console.log(data);
                                                  }
                                                }
                                              );
                                              }
                                            ).catch(function (error) {
                                                let data = {
                                                  'status': '500',
                                                  'data': {
                                                    'error': "don't update available_amount of tb_wallet success!!!"
                                                  }
                                                };
                                                // console.log(data);
                                              }
                                            );
                                          }
                                        ).catch(function (error) {
                                            let data = {
                                              'status': '500',
                                              'data': {
                                                'error': "don't count send_amount from table tb_transaction and tb_transaction_input success!!!"
                                              }
                                            };
                                            // console.log(data);
                                          }
                                        );
                                      }
                                    ).catch(function (error) {
                                        let data = {
                                          'status': '500',
                                          'data': {
                                            'error': "don't update tb_wallet success!!!"
                                          }
                                        };
                                        // console.log(data);
                                      }
                                    );
                                  }
                                ).catch(function (error) {
                                    let data = {
                                      'status': '500',
                                      'data': {
                                        'error': "don't Count amount of input package to count actual amount success!!!"
                                      }
                                    };
                                    // console.log(data);
                                  }
                                );
                              }
                            ).catch(function (error) {
                                let data = {
                                  'status': '500',
                                  'data': {
                                    'error': "don't insert tb_input_package success!!!"
                                  }
                                };
                                // console.log(data);
                              }
                            );
                          }
                        ).catch(function (error) {
                            let data = {
                              'status': '500',
                              'data': {
                                'error': "don't save data from output data to input package success!!!"
                              }
                            };
                            // console.log(data);
                          }
                        );
                      }
                    }
                  ).catch(function (error) {
                      let data = {
                        'status': '500',
                        'data': {
                          'error': "don't update status of transaction to success!!!"
                        }
                      };
                      // console.log(data);
                    }
                  );
                }
              }
            }
          ).catch(function (error) {
              let data = {
                'status': '500',
                'data': {
                  'error': 'Không lấy address, email thành công từ tb_login!!!'
                }
              };
              // console.log(data);
            }
          );
        }
      ).catch(function (error) {
          let data = {
            'status': '500',
            'data': {
              'error': 'Không lấy ref_hash thành công từ tb_input_package!!!'
            }
          };
          // console.log(data);
        }
      );
    }
  ).catch(function (error) {
      let data = {
        'status': '500',
        'data': {
          'error': 'Không lấy ref_hash thành công từ tb_transaction!!!'
        }
      };
      // console.log(data);
    }
  );
};

let secondlyJob = schedule.scheduleJob('*/5 * * * * *', function () {
  ws.send('abc')
});

exports.Listen = function (req, res, next) {
  ws.onopen
  ws.onmessage
  next()
}