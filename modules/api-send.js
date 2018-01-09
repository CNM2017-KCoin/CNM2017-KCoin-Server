let dbHelper = require('../helpers/db-helper');
let utils = require('../helpers/utils.js');
let axios = require('axios');
let speakeasy = require('speakeasy');
let nodemailer = require('nodemailer');
let twoFactor = require('node-2fa');
let logTransaction = require('./api-transaction-log');

// Convert a transaction to binary format for hashing or checking the size
let toBinary = function (transaction, withoutUnlockScript) {
  let version = Buffer.alloc(4);
  version.writeUInt32BE(transaction.version);
  let inputCount = Buffer.alloc(4);
  inputCount.writeUInt32BE(transaction.inputs.length);
  let inputs = Buffer.concat(transaction.inputs.map(input => {
    // Output transaction hash
    let outputHash = Buffer.from(input.referencedOutputHash, 'hex');
    // Output transaction index
    let outputIndex = Buffer.alloc(4);
    // Signed may be -1
    outputIndex.writeInt32BE(input.referencedOutputIndex);
    let unlockScriptLength = Buffer.alloc(4);
    // For signing
    if (!withoutUnlockScript) {
      // Script length
      unlockScriptLength.writeUInt32BE(input.unlockScript.length);
      // Script
      let unlockScript = Buffer.from(input.unlockScript, 'binary');
      return Buffer.concat([outputHash, outputIndex, unlockScriptLength, unlockScript]);
    }
    // 0 input
    unlockScriptLength.writeUInt32BE(0);
    return Buffer.concat([outputHash, outputIndex, unlockScriptLength]);
  }));
  let outputCount = Buffer.alloc(4);
  outputCount.writeUInt32BE(transaction.outputs.length);
  let outputs = Buffer.concat(transaction.outputs.map(output => {
    // Output value
    let value = Buffer.alloc(4);
    value.writeUInt32BE(output.value);
    // Script length
    let lockScriptLength = Buffer.alloc(4);
    lockScriptLength.writeUInt32BE(output.lockScript.length);
    // Script
    let lockScript = Buffer.from(output.lockScript);
    return Buffer.concat([value, lockScriptLength, lockScript]);
  }));
  return Buffer.concat([version, inputCount, inputs, outputCount, outputs]);
};

// Sign transaction
let sign = function (transaction, key) {
  let message = toBinary(transaction, true);
  transaction.inputs.forEach((input, index) => {
    let signature = utils.sign(message, key.privateKey);
    // Genereate unlock script
    input.unlockScript = 'PUB ' + key.publicKey + ' SIG ' + signature;
  });
};

exports.send = function (req, res) {
  let params = req.body || {};
  let email = params['email'] || '';
  // let receiver_address = params['receiver_address'] || '';
  // let amount = params['amount'] || '';
  let password = params['password'] || '';
  let code = params['code'] || '';
  let transactionId = params['transaction_id'] || '';

  dbHelper.dbLoadSql(
    `SELECT id, password, public_key, private_key, address, access_token
    FROM tb_login l
    WHERE l.email = ?`,
    [
      email
    ]
  ).then(
    function (userInfo) {
      //kiem tra mat khau & email hop le
      if (userInfo[0]['id'] > 0 && password == userInfo[0].password) {
        let access_token = userInfo[0]['access_token'];
        if (access_token) {
          //kiem tra otp code
          let tokenValidates = speakeasy.totp.verify({
            secret: access_token,
            encoding: 'base32',
            token: code,
            window: 6
          });
          if (!tokenValidates) {
            let data = {
              'status': '500',
              'data': {
                'error': 'Mã xác nhận không đúng!'
              }
            };
            res.send(data);
          } else {
            dbHelper.dbLoadSql(
              `SELECT t.id, t.receiver_address, t.send_amount
              FROM tb_transaction t
              WHERE t.id = ?
              AND t.status = ?`,
              [
                transactionId,
                'creating'
              ]
            ).then(
              function (TransInfo) {
                if (TransInfo[0]['id'] < 1) {
                  let data = {
                    'status': '500',
                    'data': {
                      'error': 'Không tồn tại transaction này!!!'
                    }
                  };
                  res.send(data);
                }
                let amount = TransInfo[0]['send_amount'];
                let receiver_address = TransInfo[0]['receiver_address'];
                dbHelper.dbLoadSql(
                  `SELECT id, ref_hash, ref_index, amount
                  FROM tb_input_package ip
                  WHERE ip.amount != 0
                  AND ip.user_id = ?`,
                  [
                    userInfo[0]['id']
                  ]
                ).then(
                  function (inputPackage) {
                    let countAmount = 0;
                    let listPackage = [];
                    for (let i = 0; i < inputPackage.length; i++) {
                      let packageItem = {
                        'ref_hash': inputPackage[i].ref_hash,
                        'ref_index': inputPackage[i].ref_index,
                        'amount': inputPackage[i].amount
                      };
                      listPackage.push(packageItem);
                      countAmount += inputPackage[i].amount;
                      if (countAmount >= amount) {
                        break;
                      }
                    }
                    if (countAmount < amount) {
                      let data = {
                        'status': '400',
                        'data': {
                          'error': 'Số dư của tài khoản không đủ để thực hiện giao dịch này!'
                        }
                      };
                      res.send(data);
                    } else {
                      let inputList = [];
                      for (let i = 0; i < listPackage.length; i++) {
                        let input = {
                          "unlockScript": "",
                          "referencedOutputHash": listPackage[i].ref_hash,
                          "referencedOutputIndex": listPackage[i].ref_index
                        };
                        inputList.push(input);
                      }
                      let outputList = [];
                      if (countAmount > amount) {
                        outputList = [
                          {
                            "value": parseInt(countAmount - amount),
                            "lockScript": 'ADD ' + userInfo[0].address
                          },
                          {
                            "value": parseInt(amount),
                            "lockScript": 'ADD ' + receiver_address
                          }
                        ];
                      } else {
                        outputList = [
                          {
                            "value": amount,
                            "lockScript": 'ADD ' + receiver_address
                          }
                        ];
                      }
                      let transaction = {
                        "inputs": inputList,
                        "outputs": outputList,
                        "version": 1
                      };
                      let key = {
                        "privateKey": userInfo[0].private_key,
                        "publicKey": userInfo[0].public_key,
                        "address": userInfo[0].address
                      };
                      sign(transaction, key);
                      // console.log(transaction);
                      axios.post('https://api.kcoin.club/transactions', transaction)
                        .then(function (response) {
                          // console.log('111111111111111111111111111111111');
                          // console.log(response.data);
                          let data = response.data;
                          // console.log("it's me!!!!!!!!!!!");
                          // console.log(data);
                          if (data.hash != null) {
                            dbHelper.dbLoadSql(
                              `UPDATE tb_transaction
                              SET status = ?,
                              ref_hash = ?
                              WHERE id = ?`,
                              [
                                'waiting',
                                data.hash,
                                transactionId
                              ]
                            ).then(
                              function (transactionInfo) {
                                // Insert data to transaction input
                                for (let i = 0; i < data.inputs.length; i++) {
                                  let refHash = data.inputs[i].referencedOutputHash;
                                  let refIndex = data.inputs[i].referencedOutputIndex;

                                  function isPackage(inputs) {
                                    return (inputs.ref_hash == refHash) && (inputs.ref_index == refIndex);
                                  }

                                  let packageTemp = listPackage.find(isPackage);
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
                                      transactionId,
                                      userInfo[0]['id'],
                                      userInfo[0]['address'],
                                      data.inputs[i].referencedOutputHash,
                                      data.inputs[i].referencedOutputIndex,
                                      packageTemp.amount
                                    ]
                                  ).then(function (transactionInputInfo) {
                                    // do nothing
                                  });
                                }
                                // Insert data to transaction output
                                for (let i = 0; i < data.outputs.length; i++) {
                                  dbHelper.dbLoadSql(
                                    `SELECT id, address
                                      FROM tb_login l
                                      WHERE l.address = ?`,
                                    [
                                      data.outputs[i].lockScript.substr(4, data.outputs[i].lockScript.length)
                                    ]
                                  ).then(
                                    function (userInfo2) {
                                      // console.log('usersereeeeeee')
                                      if (userInfo2[0]['id'] > 0) {
                                        dbHelper.dbLoadSql(
                                          `INSERT INTO tb_transaction_output (
                                         transaction_id,
                                         user_id,
                                         address,
                                         ref_index,
                                         amount)
                                         VALUES (?, ?, ?, ?, ?)`,
                                          [
                                            transactionId,
                                            userInfo2[0]['id'],
                                            userInfo2[0]['address'],
                                            i,
                                            data.outputs[i].value
                                          ]
                                        ).then(function (transactionInputInfo) {
                                          // do nothing
                                        });
                                      }
                                    }
                                  );
                                }
                                // Update available amount
                                dbHelper.dbLoadSql(
                                  `SELECT actual_amount
                                  FROM tb_wallet w
                                  WHERE w.user_id = ?`,
                                  [
                                    userInfo[0]['id']
                                  ]
                                ).then(
                                  function (walletInfo) {
                                    dbHelper.dbLoadSql(
                                      `UPDATE tb_wallet
                                      SET available_amount = ?
                                      WHERE user_id = ?`,
                                      [
                                        walletInfo[0]['actual_amount'] - amount,
                                        userInfo[0]['id']
                                      ]
                                    ).then(
                                      function (walletInfo2) {
                                        // do nothing
                                      }
                                    );
                                  }
                                );
                                let request = {
                                  'email': email,
                                  'transaction_id': transactionId,
                                  'action': 'send'
                                };
                                let response = [];
                                logTransaction.saveLogTransaction(request, response);
                                let returnData = {
                                  'status': '200',
                                  'data': {
                                    'report': 'Giao dịch thành công!'
                                  }
                                };
                                res.send(returnData);
                              }
                            ).catch(function (error) {
                                res.send(error);
                              }
                            );
                          }
                        })
                        .catch(function (error) {
                          // console.log('2222222222');
                          // console.log(error);
                          let data = {
                            'status': '500',
                            'data': {
                              'error': 'Giao dịch thất bại!!!'
                            }
                          };
                          res.send(data);
                        });
                      // console.log(JSON.stringify(transaction));
                    }
                  }
                );
              }
            );
          }
        } else {
          let data = {
            'status': '500',
            'data': {
              'error': 'Xác nhận thất bại!'
            }
          };
          res.send(data);
        }
      } else {
        let data = {
          'status': '500',
          'data': {
            'error': 'Giao dịch thất bại...!'
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

exports.createTransaction = function (req, res) {
  let params = req.body || {};
  let email = params['email'] || '';
  let receiverAddress = params['receiver_address'] || '';
  let amount = params['amount'] || '';

  //them giao dich voi trang thai khoi tao vao bang moi
  dbHelper.dbLoadSql(
    `SELECT id
    FROM tb_login l
    WHERE l.email = ?`,
    [
      email
    ]
  ).then(
    function (userInfo) {
      if (userInfo[0]['id'] < 1) {
        let data = {
          'status': '500',
          'data': {
            'error': 'User này không thuộc hệ thống!'
          }
        };
        res.send(data);
      }
      dbHelper.dbLoadSql(
        `INSERT INTO tb_transaction (
        ref_hash,
        send_amount,
        receiver_address)
        VALUES (?, ?, ?)`,
        [
          -1,
          amount,
          receiverAddress
        ]
      ).then(
        function (transactionInfo) {
          if (transactionInfo.insertId > 0) {
            /*let request = {
              'email': email,
              'transaction_id': transactionInfo.insertId,
              'action': 'create'

            };
            let response = [];
            logTransaction.saveLogTransaction(request, response);*/
            let data = {
              'status': '200',
              'data': {
                'report': 'Giao dịch thành công!'
              }
            };
            res.send(data);
          } else {
            let data = {
              'status': '500',
              'data': {
                'error': 'Đã có lỗi xảy ra... Vui lòng thử lại!'
              }
            };
            res.send(data);
          }
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
};

exports.sendValidate = function (req, res) {
  let params = req.body || {};
  let email = params['email'] || '';

  dbHelper.dbLoadSql(
    `SELECT access_token 
    FROM tb_login l
    WHERE l.email = ?`,
    [
      email
    ]
  ).then(
    function (userInfo) {
      let secret = userInfo[0]['access_token'];
      if (secret) {
        //send email
        let transporter = nodemailer.createTransport({
          service: 'Gmail',
          auth: {
            user: "vuquangkhtn@gmail.com",
            pass: "hoilamgi3101"
          }
        })

        let newToken = speakeasy.totp({
          secret: secret.base32,
          encoding: 'base32'
        });

        let strContext = "<div>Dear Sir/Madam,</br> You recently used " + email + " to post a transaction by your KCoin Wallet ID. To verify this email address belongs to you, please enter the code below on the verification page: " + newToken + "</div>";

        let mailOptions = {
          from: 'vuquangkhtn@gmail.com', // sender address
          to: "phamductien1417@gmail.com", // list of receivers
          subject: 'KCoin Authentication - Verify your email address', // Subject line
          text: 'You recieved message from ',
          html: strContext, // plain text body
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            let data = {
              'status': '500',
              'data': {
                'error': error
              }
            };
            res.send(data);
          } else {
            let data = {
              'status': '200',
              'data': {
                'report': 'Gửi email thành công...!'
              }
            };
            res.send(data);
          }
        });
      } else {
        let data = {
          'status': '500',
          'data': {
            'error': 'Không tìm thấy access_token!'
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

exports.cancelTransaction = function (req, res) {
  let params = req.body || {};
  let email = params['email'] || '';
  let transactionId = params['transaction_id'] || '';
  //them giao dich voi trang thai khoi tao vao bang moi
  dbHelper.dbLoadSql(
    `SELECT id
    FROM tb_login l
    WHERE l.email = ?`,
    [
      email
    ]
  ).then(
    function (userInfo) {
      if (userInfo[0]['id'] < 1) {
        let data = {
          'status': '500',
          'data': {
            'error': 'User này không thuộc hệ thống!'
          }
        };
        res.send(data);
      }
      dbHelper.dbLoadSql(
        `SELECT t.status
        FROM tb_transaction t
        WHERE t.id = ?`,
        [
          transactionId
        ]
      ).then(
        function (transactionInfo) {
          if (transactionInfo[0]['status'] == 'creating') {
            dbHelper.dbLoadSql(
              `UPDATE tb_transaction
              SET status = ?
              WHERE id = ?`,
              [
                'fail',
                transactionId
              ]
            ).then(
              function (transInfo) {
                let request = {
                  'email': email,
                  'transaction_id': transactionId,
                  'action': 'cancel'

                };
                let response = [];
                logTransaction.saveLogTransaction(request, response);
                let data = {
                  'status': '200',
                  'data': {
                    'report': 'Giao dịch thành công!'
                  }
                };
                res.send(data);
              }
            );
          } else {
            let data = {
              'status': '500',
              'data': {
                'error': 'Không thể hủy giao dịch đã gửi đi!'
              }
            };
            res.send(data);
          }
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
};