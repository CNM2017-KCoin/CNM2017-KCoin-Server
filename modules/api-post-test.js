let dbHelper = require('../helpers/db-helper');
let utils = require('../helpers/utils.js');
let axios = require('axios');

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

exports.postTest = function (req, res) {
  let params = req.body || {};
  let email = params['email'] || '';
  let receiver_address = params['receiver_address'] || '';
  let amount = params['amount'] || '';
  dbHelper.dbLoadSql(
    `SELECT id, public_key, private_key, address
    FROM tb_login l
    WHERE l.email = ?`,
    [
      email
    ]
  ).then(
    function (userInfo) {
      if (userInfo[0]['id'] > 0) {
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
              let package = {
                'ref_hash': inputPackage[i].ref_hash,
                'ref_index': inputPackage[i].ref_index,
                'amount': inputPackage[i].amount,
              };
              listPackage.push(package);
              countAmount += inputPackage[i].amount;
              if (countAmount >= amount) {
                break;
              }
            }
            if (countAmount < amount) {
              let data = {
                'status': '500',
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
              console.log('00000');
              console.log(transaction);
              let data = {
                "hash": '7660b5e452581ed48456de1da48ae9f7584ca6401aa0d10c422c55ed3795b8f8',
                "inputs":
                  [{
                    "unlockScript": "PUB 2d2d2d2d2d424547494e205055424c4943204b45592d2d2d2d2d0a4d4947664d413047435371475349623344514542415155414134474e4144434269514b4267514336e6d6f766247374941760a55523475463253315059647a6b4a6d626f39536c6b52745531647a654c716276753375695269385a3655536e4f41426e67454c754433647a684c4c626c4763630a6d59725944456b7950675152454f69312b514944415141420a2d2d2d2d2d454e44205055424c4943204b45592d2d2d2d2d0a SIG a44894fdf273e95ed500ad92958e7745822eee4e32a5fb50073d16580ca497525f3353d4ffdbe15d55c7f9a560669b6fca497293fe8705f0653a4f7031ec6a35c7b8feb8a9e6f57e90ce6437d5d6e7cdaf1b803348dd67f135e3a9563796a2a6e47052450e6440b26a157c5c8a19dd2c49532205967a5bdc0ab024e72736c784",
                    "referencedOutputHash": "fc8eae53d616bbfb0edb840a38634c34e075bf9efa8affa6bd10f06bfcacd59b",
                    "referencedOutputIndex": 1
                  }],
                "outputs":
                  [{
                    "value": 9,
                    "lockScript": "ADD 58eb4b50f39d98831adaefee010d16477df8e7c73d7ecf8a519f90b3bb75dde4"
                  },
                    {
                      "value": 1,
                      "lockScript": "ADD 72a918b9d0d21ec983f27afb721d839c967599b847e061cfb540938e7dcfd4e9"
                    }],
                "version": 1
              };
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
                            console.log('usersereeeeeee')
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
                      let data = {
                        'status': '200',
                        'data': {
                          'report': 'Giao dịch thành công!'
                        }
                      };
                      res.send(data);
                    }
                  }
                ).catch(function (error) {
                    res.send(error);
                  }
                );
              }
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

