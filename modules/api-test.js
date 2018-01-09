let dbHelper = require('../helpers/db-helper');
let nodemailer = require('nodemailer');
let speakeasy = require('speakeasy');

exports.test = function (req, res) {
  /////////////////////////////////////////
  //
  //    TEST OLD TRANSACTION
  //
  ////////////////////////////////////////
  let id = 2;
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
  );
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
};