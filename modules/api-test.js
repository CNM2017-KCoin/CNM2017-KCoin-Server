let dbHelper = require('../helpers/db-helper');
let nodemailer = require('nodemailer');
let speakeasy = require('speakeasy');

exports.test = function (req, res) {
  let data =
    {
      "hash": "00078d1d27cae93b09f1a2769d6ab4008c8db812141ac574970d28604f9ff424",
      "nonce": 2553,
      "version": 1,
      "timestamp": 1513958085,
      "difficulty": 3,
      "transactions": [
        {
          "hash": "00078d1d27cae93b09f1a2769d6ab4008c8db812141ac574970d28604f9ff484",
          "inputs": [
            {
              "unlockScript": "KCOIN BLOCKCHAIN BY KHA DO @ QUOINE JP DEC 2017",
              "referencedOutputHash": "0000000000000000000000000000000000000000000000000000000000000000",
              "referencedOutputIndex": -1
            }
          ],
          "outputs": [
            {
              "value": 100,
              "lockScript": "ADD 996b34c658a088ecc2ee72a12e8a6aca4b714c729d0d76d4db5409c08003f3dd"
            },
            {
              "value": 200,
              "lockScript": "ADD 58eb4b50f39d98831adaefee010d16477df8e7c73d7ecf8a519f90b3bb75dde4"
            }
          ],
          "version": 1
        },
        {
          "hash": "00078d1d27cae93b09f1a2769d6ab4008c8db812141ac574970d28604f9ff111",
          "inputs": [
            {
              "unlockScript": "KCOIN BLOCKCHAIN BY KHA DO @ QUOINE JP DEC 2017",
              "referencedOutputHash": "0000000000000000000000000000000000000000000000000000000000000000",
              "referencedOutputIndex": -1
            }
          ],
          "outputs": [
            {
              "value": 133311,
              "lockScript": "ADD 996b34c658a088ecc2ee72a12e8a6aca4b714c729d0d76d4db5409c08003f3dd"
            },
            {
              "value": 200,
              "lockScript": "ADD 58eb4b50f39d98831adaefee010d16477df8e7c73d7ecf8a519f90b3bb75dde4"
            }
          ],
          "version": 1
        }
      ]
    };
  // // console.log('incoming data', data);
  // console.log('Extract data', data.data);
  // // console.log('Trans data', data.data.transactions);
  let transactionServerList = data.transactions;
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
              console.log('hashsave: '+hashSaveList);
              console.log('hashChooseList: '+hashChooseList);
              console.log(transactionServerList.length);
              console.log(hashChooseList);
              // CASE 1: catch intput
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
                          receiver_address,
                          status)
                          VALUES (?, ?, ?, ?)`,
                          [
                            transactionServerList[i]['hash'],
                            outputServerList[k]['value'],
                            AddressList[h]['address'],
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
                                    console.log(data);
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
                                  console.log(data);
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
                            console.log(data);
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
                                            // send mail report changed 2
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
                                            let strContext = "<div>Dear Sir/Madam,</br> Your amounts have been changed in KCoin Wallet. Your new available amount is " + newAvailableAmount + " and actual amount is " + newActualAmount + "</div>";

                                            let mailOptions = {
                                              from: 'vuquangkhtn@gmail.com', // sender address
                                              to: AddressList[h]['email'], // list of receivers
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
                                                'error': "don't update available amount on tb_wallet 2 success!!!"
                                              }
                                            };
                                            console.log(data);
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
                                        console.log(data);
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
                                    console.log(data);
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
                            console.log(data);
                          }
                        );
                      }
                    }
                  }
                }
              }
            }
          );
        }
      );
    }
  );

  /////////////////////////////////////////
  //
  //    TEST OLD TRANSACTION
  //
  ////////////////////////////////////////
  /*let id = 2;
  let email = 'ad@gmail.com';
  let address = 'ad@gmail.com';
  let receiver_address = "996b34c658a088ecc2ee72a12e8a6aca4b714c729d0d76d4db5409c08003f3dd";
  dbHelper.dbLoadSql(
    `SELECT id, email, address
    FROM tb_login l
    WHERE l.address = ?`,
    [
      receiver_address
    ]
  ).then(
    function (oldUserInfo) {
      if (oldUserInfo[0]['id'] < 1) {
        let data = {
          'status': '500',
          'data': {
            'error': "Address không thuộc hệ thống!"
          }
        };
        console.log(data);
      }
      dbHelper.dbLoadSql(
        `SELECT COUNT(tto.id) as total
        FROM tb_transaction_old tto
        WHERE tto.user_id = ?
        AND tto.old_id = ?`,
        [
          id,
          oldUserInfo[0]['id']
        ]
      ).then(
        function (oldTransactionInfo) {
          if (oldTransactionInfo[0]['total'] > 0) {
            // do nothing
            console.log('do nothing');
          } else {
            dbHelper.dbLoadSql(
              `INSERT INTO tb_transaction_old (
              user_id,
              old_id,
              old_email,
              old_address)
              VALUES (?, ?, ?, ?)`,
              [
                id,
                oldUserInfo[0]['id'],
                oldUserInfo[0]['email'],
                oldUserInfo[0]['address'],
              ]
            ).then(
              function (oldTransactionInfo2) {
                if (oldTransactionInfo2.insertId > 0) {
                  dbHelper.dbLoadSql(
                    `INSERT INTO tb_transaction_old (
                    user_id,
                    old_id,
                    old_email,
                    old_address)
                    VALUES (?, ?, ?, ?)`,
                    [
                      oldUserInfo[0]['id'],
                      id,
                      email,
                      address,
                    ]
                  ).then(
                    function (oldTransactionInfo2) {
                      if (oldTransactionInfo2.insertId > 0) {
                        // do nothing
                        let data = {
                          'status': '200',
                          'data': {
                            'report': "OK!!!"
                          }
                        };
                        console.log(data);
                      }
                    }
                  ).catch(function (error) {
                      let data = {
                        'status': '500',
                        'data': {
                          'error': "Lỗi!"
                        }
                      };
                      console.log(data);
                    }
                  );
                }
              }
            ).catch(function (error) {
                let data = {
                  'status': '500',
                  'data': {
                    'error': "Lỗi!!!"
                  }
                };
                console.log(data);
              }
            );
          }
        }
      ).catch(function (error) {
          let data = {
            'status': '500',
            'data': {
              'error': "Address không thuộc hệ thống!!!"
            }
          };
          console.log(data);
        }
      );
    }
  ).catch(function (error) {
      let data = {
        'status': '500',
        'data': {
          'error': "Address không thuộc hệ thống!!!"
        }
      };
      console.log(data);
    }
  );*/

  /////////////////////////////////////////
  //
  //    TEST 2FA
  //
  ////////////////////////////////////////
  /*var secret = speakeasy.generateSecret({length: 20});
  // Returns an object with secret.ascii, secret.hex, and secret.base32.
  // Also returns secret.otpauth_url, which we'll use later.
  console.log(secret);
  var token = speakeasy.totp({
    secret: secret.base32,
    encoding: 'base32'
  });

  console.log(token);
  // Verify a given token
  var tokenValidates = speakeasy.totp.verify({
    secret: secret.base32,
    encoding: 'base32',
    token: token,
    window: 6
  });
  // Returns true if the token matches
  if (tokenValidates == true) {
    console.log('ok');
  }

  // Verify a given token is within 3 time-steps (+/- 2 minutes) from the server
  // time-step.
    var tokenDelta = speakeasy.totp.verifyDelta({
      secret: secret.base32,
      encoding: 'base32',
      token: token,
      window: 2,
      step: 60
    });
  console.log('hmmm' + tokenDelta);*/

  /////////////////////////////////////////
  //
  //    TEST MAILER
  //
  ////////////////////////////////////////
  // Returns {delta: 0} where the delta is the time step difference
  // between the given token and the current time
  /*var transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: 'phamductien133@gmail.com',
      pass: 'Aspirine1'
    }
  });

  var mailOptions = {
    from: 'phamductien133@gmail.com',
    to: 'phamductien1417@gmail.com',
    subject: 'Sending Email using Node.js',
    text: 'That was easy!'
  };

  transporter.sendMail(mailOptions, function(error, info){
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });*/
}
;