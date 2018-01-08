let dbHelper = require('../helpers/db-helper');
let nodemailer = require('nodemailer');
exports.test = function (req, res) {
  var transporter = nodemailer.createTransport({
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
  });
};