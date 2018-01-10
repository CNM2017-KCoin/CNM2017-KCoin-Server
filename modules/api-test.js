let dbHelper = require('../helpers/db-helper');
let nodemailer = require('nodemailer');
let speakeasy = require('speakeasy');

exports.test = function (req, res) {
  let data =
    {
      "hash": "00078d1d27cae93b09f1a2769d6ab4008c8db812141ac574970d28604f9ff484",
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
              "value": 100,
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