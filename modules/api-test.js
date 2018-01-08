let dbHelper = require('../helpers/db-helper');
let nodemailer = require('nodemailer');
let speakeasy = require('speakeasy');

exports.test = function (req, res) {
  var secret = speakeasy.generateSecret({length: 20});
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
  console.log('hmmm' + tokenDelta);
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