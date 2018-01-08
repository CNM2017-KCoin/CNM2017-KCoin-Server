let dbHelper = require('../helpers/db-helper');
let utils = require('../helpers/utils.js');
let axios = require('axios');

let toBinary = function (transaction, withoutUnlockScript) {
  let dataTest = {
    "hash": "000023a2169f138d095294b7c23df837a1f1059b1ae338b5287316f16d64307f",
    "nonce": 1556,
    "version": 1,
    "timestamp": 1513958560,
    "difficulty": 3,
    "transactions": [
      {
        "hash": "2a68277346418c850a2fcbcfc059d486222689fab237f1b20fe20c8b41a84d9b",
        "inputs": [
          {
            "unlockScript": "DATETIME Fri Dec 22 2017 16:02:40 GMT+0000 (UTC)",
            "referencedOutputHash": "0000000000000000000000000000000000000000000000000000000000000000",
            "referencedOutputIndex": -1
          }
        ],
        "outputs": [
          {
            "value": 281190,
            "lockScript": "ADD aa5f720c8080d81b9bd9781bf85c38c4d24cc010d0536e667f169ac8a5eb72d0"
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
            "value": 281190,
            "lockScript": "ADD aa5f720c8080d81b9bd9781bf85c38c4d24cc010d0536e667f169ac8a5eb72d0"
          }
        ],
        "version": 1
      }
    ],
    "transactionsHash": "2a68277346418c850a2fcbcfc059d486222689fab237f1b20fe20c8b41a84d9b",
    "previousBlockHash": "00078d1d27cae93b09f1a2769d6ab4008c8db812141ac574970d28604f9ff484"
  };
  let transactionDataList = dataTest.transactions;
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
          for (let i = 0; i < transactionDataList.length; i++) {
            // Check in transaction of my server have hash like data of receive server data
            // => update status = success
            for (let j = 0; j < transactionList.length; j++) {
              // when have hash like my server
              if (transactionDataList[i]['hash'] == transactionList[j]['ref_hash']) {
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
                let inputList = transactionDataList[i].inputs;
                for (let j = 0; j < inputPackageList.length; j++) {
                  for (let k = 0; k < inputList.length; k++) {
                    if (inputList[k]['referencedOutputHash'] == inputPackageList[j]['ref_hash']
                      && inputList[k]['referencedOutputIndex'] == inputPackageList[j]['ref_index']) {
                      dbHelper.dbLoadSql(
                        `UPDATE tb_input_package
                    SET amount = ?
                    WHERE id = ?`,
                        [
                          0,
                          inputPackageList[j]['id']
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
                let outputList = transactionDataList[i].outputs;
                for (let j = 0; j < outputList.length; j++) {
                  // get user_id by address
                  dbHelper.dbLoadSql(
                    `SELECT id
                FROM tb_login l
                WHERE l.address = ?`,
                    [
                      outputList[j]['lockScript'].substr(4, outputList[j]['lockScript'].length)
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
                          transactionDataList[i].hash,
                          j,
                          outputList[j]['value']
                        ]
                      ).then(
                        function (inputPackInfo) {
                          // Count amount of input package to count actual amount
                          dbHelper.dbLoadSql(
                            `SELECT COUNT(amount) as total_actual_amount
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
                            SET 	actual_amount = ?
                            WHERE user_id = ?`,
                                [
                                  actualAmountInfo[0]['total_actual_amount'],
                                  userInfo[0]['id']
                                ]
                              ).then(
                                function (walletInfo) {
                                  // count send_amount from table tb_transaction and tb_transaction_input
                                  dbHelper.dbLoadSql(
                                    `SELECT COUNT(t.send_amount) as total_send_amount
                                FROM tb_transaction t
                                LEFT JOIN tb_transaction_input ti ON t.id = ti.transaction_id
                                WHERE t.status = ?`,
                                    [
                                      'waiting'
                                    ]
                                  ).then(
                                    function (sendAmountInfo) {
                                      // update available amount on tb_wallet
                                      dbHelper.dbLoadSql(
                                        `UPDATE tb_wallet
                                    SET	available_amount = ?
                                    WHERE user_id = ?`,
                                        [
                                          actualAmountInfo[0]['actual_amount'] - sendAmountInfo[0]['total_send_amount'],
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
        }
      );
    }
  );

};

