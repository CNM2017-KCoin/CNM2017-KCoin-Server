let dbHelper = require('../helpers/db-helper');
let utils = require('../helpers/utils.js');

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
  dbHelper.dbLoadSql(
    `SELECT id, public_key, private_key, address
    FROM tb_login l
    WHERE l.email = ?`,
    [
      email
    ]
  ).then(
    function (userInfo) {
      let data = [];
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
            for (let i = 0; i < inputPackage.length || countAmount <= amount; i++) {
              let package = {
                'ref_hash': inputPackage[i].ref_hash,
                'ref_index': inputPackage[i].ref_index,
              };
              listPackage.push(package);
              countAmount += inputPackage[i].amount;
            }
            if (countAmount < amount) {
              data = {
                'status': '500',
                'data': {
                  'error': 'Số dư của tài khoản không đủ để thực hiện giao dịch này!'
                }
              };
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
                    "lockScript": '"ADD ' + address + '"'
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
              console.log('1111111');
              console.log(JSON.stringify(transaction));
            }
          }
        );
      } else {
        data = {
          'status': '500',
          'data': {
            'error': 'Giao dịch thất bại!'
          }
        };
      }
      res.send(data);
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

