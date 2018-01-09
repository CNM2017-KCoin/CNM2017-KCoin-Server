const WebSocket = require('ws');
const ws = new WebSocket('wss://api.kcoin.club/');
let schedule = require('node-schedule');
let dbHelper = require('../helpers/db-helper');
let logTransaction = require('./api-transaction-log');

ws.onopen = function () {
  // console.log('connected');
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
              for (let i = 0; i < transactionServerList.length; i++) {
                hashServerList.push(transactionServerList[i]['hash']);
              }
              for (let i = 0; i < transactionList.length; i++) {
                hashList.push(transactionList[i]['ref_hash']);
              }
              let hashSaveList = [];
              for (let i = 0; i < hashServerList.length; i++) {
                if (hashList.includes(hashServerList[i])) {
                } else {
                  hashSaveList.push(hashServerList[i]);
                }
              }
              // CASE 1: catch input
              for (let i = 0; i < transactionServerList.length; i++) {
                // Check in transaction of my server have hash like data of receive server data
                // => update status = success
                for (let j = 0; j < transactionList.length; j++) {
                  //  when have hash like my server
                  if (transactionServerList[i]['hash'] == transactionList[j]['ref_hash']) {
                    // console.log("it's me!!!!!!!!!!!!!");
                    // update status of transaction to success
                    dbHelper.dbLoadSql(
                      `UPDATE tb_transaction
                      SET status = ?
                      WHERE id = ?
                      AND status = ?`,
                      [
                        'success',
                        transactionList[j]['id'],
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
                                            SET	available_amount = ?
                                            WHERE user_id = ?`,
                                                [
                                                  actualAmountInfo[0]['total_actual_amount'] - sendAmountInfo[0]['total_send_amount'],
                                                  userInfo[0]['id']
                                                ]
                                              ).then(
                                                function (walletInfo2) {
                                                  let request = {
                                                    'email': userInfo[0]['email'],
                                                    'transaction_id': transactionList[j]['id'],
                                                    'action': 'send_success'
                                                  };
                                                  let response = [];
                                                  logTransaction.saveLogTransaction(request, response);
                                                  // do nothing
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
              // CASE 2: catch output
              // Check in output data of receive server data have address like my server
              // save data to transaction, trans_input, trans_output
              // save data to package
              for (let i = 0; i < transactionServerList.length; i++) {
                if (hashSaveList.includes(transactionServerList[i]['hash'])) {
                  let outputServerList = transactionServerList[i]['outputs'];
                  let inputServerList = transactionServerList[i]['inputs'];
                  for (let k = 0; k < outputServerList.length; k++) {
                    for (let h = 0; h < AddressList.length; h++) {
                      // Check if exist address like address of my server
                      if (AddressList[h]['address'] == outputServerList[k]['lockScript'].substr(4, outputServerList[k]['lockScript'].length)) {
                        // save to table transaction
                        dbHelper.dbLoadSql(
                          `INSERT INTO tb_transaction (
                          ref_hash,
                          send_amount,
                          status)
                          VALUES (?, ?, ?)`,
                          [
                            transactionServerList[i]['hash'],
                            outputServerList[k]['value'],
                            'success'
                          ]
                        ).then(
                          function (transactionInfo) {
                            if (transactionInfo.insertId > 0) {
                              // save table transaction_input
                              for (let l = 0; l < inputServerList.length; l++) {
                                dbHelper.dbLoadSql(
                                  `INSERT INTO tb_transaction_input (
                                  transaction_id,
                                  user_id,
                                  address,
                                  ref_hash,
                                  ref_index,
                                  amount)
                                  VALUES (?, ?, ?, ?, ?, ?)`,
                                  [
                                    transactionInfo.insertId,
                                    -1,
                                    -1,
                                    inputServerList[l]['referencedOutputHash'],
                                    inputServerList[l]['referencedOutputIndex'],
                                    -1
                                  ]
                                ).then(
                                  function (transactionInputInfo) {
                                    // do nothing
                                  }
                                ).catch(function (error) {
                                    let data = {
                                      'status': '500',
                                      'data': {
                                        'error': "don't save table transaction_input 2 success!!!"
                                      }
                                    };
                                    // console.log(data);
                                  }
                                );
                              }
                              // save table transaction_output
                              dbHelper.dbLoadSql(
                                `INSERT INTO tb_transaction_output (
                                transaction_id,
                                user_id,
                                address,
                                ref_index,
                                amount)
                                VALUES (?, ?, ?, ?, ?)`,
                                [
                                  transactionInfo.insertId,
                                  AddressList[h]['id'],
                                  AddressList[h]['address'],
                                  k,
                                  outputServerList[k]['value']
                                ]
                              ).then(
                                function (transactionOutputInfo) {
                                  if (transactionOutputInfo.insertId > 0) {
                                    let request = {
                                      'email': AddressList[h]['email'],
                                      'transaction_id': transactionInfo.insertId,
                                      'action': 'receive'
                                    };
                                    let response = [];
                                    logTransaction.saveLogTransaction(request, response);
                                    // do nothing
                                  }
                                }
                              ).catch(function (error) {
                                  let data = {
                                    'status': '500',
                                    'data': {
                                      'error': "don't save table transaction_output 2 success!!!"
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
                                'error': "don't save to table transactions success!!!"
                              }
                            };
                            // console.log(data);
                          }
                        );
                        // save to table package
                        dbHelper.dbLoadSql(
                          `INSERT INTO tb_input_package (
                          user_id,
                          ref_hash,
                          ref_index,
                          amount)
                          VALUES (?, ?, ?, ?)`,
                          [
                            AddressList[h]['id'],
                            transactionServerList[i]['hash'],
                            k,
                            outputServerList[k]['value'],
                          ]
                        ).then(
                          function (packageInfo) {
                            // Count amount of input package to count actual amount
                            dbHelper.dbLoadSql(
                              `SELECT SUM(ip.amount) as total_actual_amount
                              FROM tb_input_package ip
                              WHERE ip.user_id = ?
                              AND ip.amount != ?`,
                              [
                                AddressList[h]['id'],
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
                                    AddressList[h]['id']
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
                                        AddressList[h]['id']
                                      ]
                                    ).then(
                                      function (sendAmountInfo) {
                                        // update available amount on tb_wallet
                                        dbHelper.dbLoadSql(
                                          `UPDATE tb_wallet
                                          SET	available_amount = ?
                                          WHERE user_id = ?`,
                                          [
                                            actualAmountInfo[0]['total_actual_amount'] - sendAmountInfo[0]['total_send_amount'],
                                            AddressList[h]['id']
                                          ]
                                        ).then(
                                          function (walletInfo2) {
                                            // do nothing
                                          }
                                        ).catch(function (error) {
                                            let data = {
                                              'status': '500',
                                              'data': {
                                                'error': "don't update available amount on tb_wallet 2 success!!!"
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
                                            'error': "don't count send_amount from table tb_transaction and tb_transaction_input 2 success!!!"
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
                                        'error': "don't update actual amount on tb_wallet 2 success!!!"
                                      }
                                    };
                                    // console.log(data);
                                  }
                                );
                              }
                            );
                          }
                        ).catch(function (error) {
                            let data = {
                              'status': '500',
                              'data': {
                                'error': "don't save to table package 2 success!!!"
                              }
                            };
                            // console.log(data);
                          }
                        );
                      }
                    }
                  }
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