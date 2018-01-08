let dbHelper = require('../helpers/db-helper');
let utils = require('../helpers/utils.js');
let axios = require('axios');
exports.webSocketTest = function (req, res) {
  let dataTest = {
    "hash": "000023a2169f138d095294b7c23df837a1f1059b1ae338b5287316f16d64307f",
    "nonce": 1556,
    "version": 1,
    "timestamp": 1513958560,
    "difficulty": 3,
    "transactions": [
      {
        "hash": "c2a2cf8376f3cbb800d726e8e8e36103d570ffb2eaeb63a9a0bec886aa53d50e",
        "inputs": [
          {
            "unlockScript": "DATETIME Fri Dec 22 2017 16:02:40 GMT+0000 (UTC)",
            "referencedOutputHash": "27c5a07f2ab387d8904ec3e7e48192ef938c35366d32c51d77f1ba5a9201a65f",
            "referencedOutputIndex": 1
          },
          {
            "unlockScript": "DATETIME Fri Dec 22 2017 16:02:40 GMT+0000 (UTC)",
            "referencedOutputHash": "27c5a07f2ab387d8904ec3e7e48192ef938c35366d32c51d77f1ba5a9201a65s",
            "referencedOutputIndex": 1
          }
        ],
        "outputs": [
          {
            "value": 133,
            "lockScript": "ADD 58eb4b50f39d98831adaefee010d16477df8e7c73d7ecf8a519f90b3bb75dde4"
          }
        ],
        "version": 1
      },
      {
        "hash": "4225e689306c6f2f7681b71e33d9c3f27ef30d51ab87949fb91220783f97d4d4",
        "inputs": [
          {
            "unlockScript": "DATETIME Fri Dec 22 2017 16:12:56 GMT+0000 (UTC)",
            "referencedOutputHash": "0000000000000000000000000000000000000000000000000000000000000000",
            "referencedOutputIndex": -1
          }
        ],
        "outputs": [
          {
            "value": 100,
            "lockScript": "ADD 58eb4b50f39d98831adaefee010d16477df8e7c73d7ecf8a519f90b3bb75dde4"
          }
        ],
        "version": 1
      }
    ],
    "transactionsHash": "2a68277346418c850a2fcbcfc059d486222689fab237f1b20fe20c8b41a84d9b",
    "previousBlockHash": "00078d1d27cae93b09f1a2769d6ab4008c8db812141ac574970d28604f9ff484"
  };
  let transactionServerList = dataTest.transactions;
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
            `SELECT l.id, l.address
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
                    console.log("it's me!!!!!!!!!!!!!");
                    // update status of transaction to success
                    dbHelper.dbLoadSql(
                      `UPDATE tb_transaction
                      SET status = ?
                      WHERE id = ?`,
                      [
                        'success',
                        transactionList[j]['id']
                      ]
                    ).then(
                      function (transInfo) {
                        // do nothing
                      }
                    );
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
                          );
                        }
                      }
                    }
                    // get ref_hash, ref_index in output of reiceive server data to save on my server
                    let outputServerList = transactionServerList[i].outputs;
                    for (let k = 0; k < outputServerList.length; k++) {
                      // get user_id by address
                      dbHelper.dbLoadSql(
                        `SELECT id
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
                                              // do nothing
                                            }
                                          );
                                        }
                                      );
                                    }
                                  );
                                }
                              );
                            }
                          );
                        }
                      );
                    }
                  }
                }
              }
              // CASE 2: catch output
              // Check in output data of receive server data have address like my server
              // save data to transaction, trans_input, trans_output
              // save data to package
              for (let i = 0; i < transactionServerList.length; i++){
                if (hashSaveList.includes(transactionServerList[i]['hash'])){
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
                                    // do nothing
                                  }
                                }
                              );
                            }
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
                                        );
                                      }
                                    );
                                  }
                                );
                              }
                            );
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
}
