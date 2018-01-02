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
      return Buffer.concat([ outputHash, outputIndex, unlockScriptLength, unlockScript ]);
    }
    // 0 input
    unlockScriptLength.writeUInt32BE(0);
    return Buffer.concat([ outputHash, outputIndex, unlockScriptLength]);
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
    return Buffer.concat([value, lockScriptLength, lockScript ]);
  }));
  return Buffer.concat([ version, inputCount, inputs, outputCount, outputs ]);
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

var transaction = {
  "inputs":[
    {
      "unlockScript":"",
      "referencedOutputHash":"231950d7087e75d7a7fa045187baa04254896be4e9381ddc105ca23dda643c24",
      "referencedOutputIndex":6
    }
  ],
  "outputs":[
    {
      "value":9990,
      "lockScript":"ADD f25921e2aa64e494ff00b5ab09a5f728b36de97a2dea1d421433fda779edfe0d"
    },
    {
      "value":10,
      "lockScript":"ADD 72a918b9d0d21ec983f27afb721d839c967599b847e061cfb540938e7dcfd4e9"
    }
  ],
  "version":1
};

exports.send = function (req, res) {
  var key = {"privateKey":"2d2d2d2d2d424547494e205253412050524956415445204b45592d2d2d2d2d0a4d4949435851494241414b42675143307167355a643167497a57646f4c42747a55363365703476426a51456149475a346544624c47746330464f7a2f753070760a674361526f2f69616e6a7a487534366267737a6830646836435448644a312f4571717472793461537055737557474a647639306c596935507976494f387551320a50515867736f75725376414d4672785a466d6277314c4238462b2f46444c537538525a3369362b414f4e4656523568496b71554641367a7459514944415141420a416f47414e7a5054434b452f78416a484e5078744d744c35794a5058547a2b2f653355302b6c42354a5a78413734674a567161717575456b5a394837623373300a5253395a42736c7a777668307465314455446a73755649513647355066687a4466753835656477515236344a617752392b773544564c366d45524e70475a6a510a48415436415467346f546779376b764f6133574e2b337a6138736178654c6b506945453448676a545142712f654855435151446e793763464463396648645a760a74577531564d6b4f344958464a66354d72766a754a4b562f6e56436254344b794c73483547492f726a3244667a63724d5a59544e42464b41524d526d4e3575780a48577a7771313137416b45417834654443737976422b4d714663745a367a6a4139343131427966717243626b58354b584b5a566771644672624c6b48445041570a625970527974522b6b34783058646265656f3564544d394f453036585332425430774a42414c63784c6b556c512f59466139732f673439394961584c566f32590a5747476369346f536c6d58454739655451465334565838627057726a46776e703539516769354e49546a656e6f5a797a6143335464717a436b6f3843515143620a713373756f7444774b326837526f4d71424d5a776e566d767370486872427044416f43545065734473744c494b586435765a735237586577387161716755754d0a7077592b77664843366e3430692f3134486e686e416b41323633533932462f557035646f4c2f526b54485a6762324c686d432f2b306a2b315a494b4c6e5368480a78796371467a6246455a31726469776e6563305053734f6a2b624c6569652b715162543962336774696576730a2d2d2d2d2d454e44205253412050524956415445204b45592d2d2d2d2d0a","publicKey":"2d2d2d2d2d424547494e205055424c4943204b45592d2d2d2d2d0a4d4947664d413047435371475349623344514542415155414134474e4144434269514b42675143307167355a643167497a57646f4c42747a55363365703476420a6a51456149475a346544624c47746330464f7a2f75307076674361526f2f69616e6a7a487534366267737a6830646836435448644a312f4571717472793461530a7055737557474a647639306c596935507976494f3875513250515867736f75725376414d4672785a466d6277314c4238462b2f46444c537538525a3369362b410a4f4e4656523568496b71554641367a7459514944415141420a2d2d2d2d2d454e44205055424c4943204b45592d2d2d2d2d0a","address":"f25921e2aa64e494ff00b5ab09a5f728b36de97a2dea1d421433fda779edfe0d"};
  sign(transaction, key);
  console.log(JSON.stringify(transaction));

  // let params = req.body || {};
  // let email = params['email'] || '';
  // let receiverAddress = params['receiver_address'] || '';
  // let amount = params['amount'] || '';
  // dbHelper.dbLoadSql(
  //   `SELECT id 
  //   FROM tb_login l
  //   WHERE l.email = ?
  //   AND l.password = ?`,
  //   [
  //     email,
  //     password
  //   ]
  // ).then(
  //   function (userInfo) {
  //     console.log(userInfo);
  //     let data = [];
  //     if (userInfo[0]['id'] > 0) {
  //       data = {
  //         'status': '200',
  //         'data': {
  //           'report': 'Đăng nhập thành công!'
  //         }
  //       };
  //     } else {
  //       data = {
  //         'status': '500',
  //         'data': {
  //           'error': 'Đăng nhập thất bại!'
  //         }
  //       };
  //     }
  //     res.send(data);
  //   }
  // ).catch(function (error) {
  //     let data = {
  //       'status': '500',
  //       'data': {
  //         'error': 'Đã có lỗi xảy ra... Vui lòng thử lại!'
  //       }
  //     };
  //     res.send(data);
  //   }
  // );
};

