let dbHelper = require('../helpers/db-helper');
let utils = require('../helpers/utils.js');
let nodemailer = require('nodemailer');
let speakeasy = require('speakeasy');

exports.register = function (req, res) {
  let params = req.body || {};
  let email = params['email'] || '';
  let password = params['password'] || '';

  if (email == '' || password == '') {
    let data = {
      'status': '500',
      'data': {
        'error': 'Vui lòng gửi email, mật khẩu...!'
      }
    };
    res.send(data);
  } else {
    dbHelper.dbLoadSql(
      `SELECT COUNT(id) AS total 
      FROM tb_login l
      WHERE l.email = ?`,
      [
        email
      ]
    ).then(
      function (Total) {
        if (Total[0]['total']) {
          let data = {
            'status': '500',
            'data': {
              'error': 'Đã tồn tại user này...!'
            }
          };
          res.send(data);
        } else {
          var info = utils.generateAddress();
          //create access_token
          let secret = speakeasy.generateSecret({length: 20});

          dbHelper.dbLoadSql(
            `INSERT INTO tb_login (
            email, 
            password,
            public_key,
            private_key,
            access_token,
            address)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
              email,
              password,
              info.publicKey,
              info.privateKey,
              secret.base32,
              info.address
            ]
          ).then(
            function (userInfo) {
              if (userInfo.insertId > 0) {
                dbHelper.dbLoadSql(
                  `INSERT INTO tb_wallet (
                  user_id)
                  VALUES (?)`,
                  [
                    userInfo.insertId
                  ]
                ).then(function (wallet) {
                  if (wallet.insertId > 0) {
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
                    // { token: '630618' } 
                    let strContext = "<div>Dear Sir/Madam,</br> You recently added "+email+" as your new KCoin Wallet ID. To verify this email address belongs to you, please enter the code below on the verification page: " + newToken +" </br> Click <a href=\"https://dack-kcoin-wantien.herokuapp.com/vertify?email="+email+"\">here</a> to vertify code</div>";

                    let mailOptions = {
                          from: 'vuquangkhtn@gmail.com', // sender address
                          to: "phamductien1417@gmail.com", // list of receivers
                          subject: 'KCoin Authentication - Verify your email address', // Subject line
                          text: 'You recieved message from ',
                          html: strContext, // plain text body
                      };

                    transporter.sendMail(mailOptions,(error, info) => {
                      if (error) {
                        let data = {
                          'status': '500',
                          'data': {
                            'error': 'Đã có lỗi xảy ra... Vui lòng thử lại!'
                          }
                        };
                        res.send(data);
                      } else {
                        let data = {
                          'status': '200',
                          'data': {
                            'report': 'Đăng ký thành công...!'
                          }
                        };
                        res.send(data);
                      }
                    });
                  }
                  else {
                    let data = {
                      'status': '500',
                      'data': {
                        'error': 'Đăng ký thất bại...!'
                      }
                    };
                    res.send(data);
                  }
                });
              }
            }
          ).catch(function (error) {
              res.send(error);
            }
          );
        }
      }
    );
  }
};

exports.userValidate = function (req, res) {
  let params = req.body || {};
  let email = params['email'] || '';
  let code = params['code'] || '';

  if (email == '' || code == '') {
    let data = {
      'status': '500',
      'data': {
        'error': 'Xác nhận thất bại!'
      }
    };
    res.send(data);
  } else {
    dbHelper.dbLoadSql(
      `SELECT access_token
      FROM tb_login l
      WHERE l.email = ?`,
      [
        email
      ]
    ).then(
      function (userInfo) {
        let access_token = userInfo[0]['access_token'];
        if (access_token) {
          let tokenValidates = speakeasy.totp.verify({
            secret: access_token,
            encoding: 'base32',
            token: code,
            window: 6
          });
          if (tokenValidates != true) {
            let data = {
              'status': '500',
              'data': {
                'error': 'Mã xác nhận không đúng!'
              }
            };
            res.send(data);
          } else {
            dbHelper.dbLoadSql(
            `UPDATE tb_login
            SET status = ?
            WHERE email = ?`,
            [
              1,
              email
            ]
          ).then(
            function (transInfo) {
              
            let data = {
              'status': '200',
              'data': {
                'report': 'Kích hoạt thành công!'
              }
            };
            res.send(data);
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
      }
    );
  }

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