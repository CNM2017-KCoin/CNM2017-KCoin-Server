let dbHelper = require('../helpers/db-helper');
let utils = require('../helpers/utils.js');
let axios = require('axios');
let nodemailer = require('nodemailer');
let twoFactor = require('node-2fa');

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
  let receiver_address = params['receiver_address'] || '';
  let amount = params['amount'] || '';
  // let vertifyToken = params['token'];
  // let code = params['code'] || '';
  // let pass = params['password'] || '';

  dbHelper.dbLoadSql(
    `SELECT id, password, public_key, private_key, address
    FROM tb_login l
    WHERE l.email = ?`,
    [
      email
    ]
  ).then(
    function (userInfo) {
      if (userInfo[0]['id'] > 0) {
        // if(pass == userInfo[0]['password']) {
        //   let res = twoFactor.verifyToken(verifyToken, code);
        //   if(res.delta == 0) {
        //     //true

            
        //   } else if(res.delta == -1) {
        //     //too late, new one created
        //     let data = {
        //       'status': '400',
        //       'data': {
        //         'error': 'Code đã hết hạn!'
        //       }
        //     };
        //     res.send(data);
        //   } else {
        //     //too early, new one not created
        //     let data = {
        //       'status': '400',
        //       'data': {
        //         'error': 'Chuỗi code mới chưa được tạo!'
        //       }
        //     };
        //     res.send(data);
        //   }
        // } else {
        //   let data = {
        //     'status': '400',
        //     'data': {
        //       'error': 'Mật khẩu không trùng khớp!'
        //     }
        //   };
        //   res.send(data);
        // }

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
                      `INSERT INTO tb_transaction (
                       ref_hash,
                       send_amount)
                       VALUES (?, ?)`,
                      [
                        data.hash,
                        amount
                      ]
                    ).then(
                      function (transactionInfo) {
                        if (transactionInfo.insertId > 0) {
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
                                transactionInfo.insertId,
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
                                      transactionInfo.insertId,
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
                          let returnData = {
                            'status': '200',
                            'data': {
                              'report': 'Giao dịch thành công!'
                            }
                          };
                          res.send(returnData);
                        }
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


exports.sendValidate = function (req, res) {
  let params = req.body || {};
  let email = params['email'] || '';

  // //get code
  // let newSecret = twoFactor.generateSecret({name: 'KCoin Wallet', account:email});
  // console.log(newSecret);
  // let newToken = twoFactor.generateToken(newSecret.secret);
  // // { token: '630618' } 
   
  // // twoFactor.verifyToken('XDQXYCP5AC6FA32FQXDGJSPBIDYNKK5W', '765075');
  // // // { delta: 0 } 
   
  // // twoFactor.verifyToken('XDQXYCP5AC6FA32FQXDGJSPBIDYNKK5W', '00');

  // //send email
  // let transporter = nodemailer.createTransport({
  //   service: 'Gmail',
  //   auth: {
  //     user: "vuquangkhtn@gmail.com",
  //     pass: "hoilamgi3101"
  //   }
  // })

  // let strContext = "<div>Dear Sir/Madam,</br> You recently added "+email+" as your new KCoin Wallet ID. To verify this email address belongs to you, please enter the code below on the email verification page:</br> " + newToken +"</div>";

  // let mailOptions = {
  //       from: '"KCoin Wallet Admin" <vuquangkhtn@gmail.com>', // sender address
  //       to: email, // list of receivers
  //       subject: 'KCoin Authentication - Verify your email addres', // Subject line
  //       html: strContext, // plain text body
  //   };

  // transporter.sendMail(mailOptions,(error, info) => {

  //   if (error) {
  //     let data = {
  //       'status': '500',
  //       'data': {
  //         'error': 'Đã có lỗi xảy ra... Vui lòng thử lại!'
  //       }
  //     };
  //     res.send(data);
  //   } else {
  //     let data = {
  //       'status': '200',
  //       'data': {
  //         'report': 'Gửi mail xác nhận thành công!'
  //       }
  //     };
  //     res.send(data);
  //   }
  // });
};
