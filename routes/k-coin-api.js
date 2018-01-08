let express = require('express');
let coreApiRoute = express.Router();

let apiTest = require('../modules/api-test');
let apiRegister = require('../modules/api-register');
let apiLogin = require('../modules/api-login');
let apiUserInfo = require('../modules/api-user-info');
let apiSend = require('../modules/api-send');
let apiPostTest = require('../modules/api-post-test');
let apiWebSocketTest = require('../modules/api-websocket-test');
let apiTransactionOutput = require('../modules/api-transaction-output');
let apiTransactionInput = require('../modules/api-transaction-input');

coreApiRoute.get('/test', function (req, res) {
  apiTest.test(req, res);
});

// Api register
coreApiRoute.post('/register', function (req, res) {
  apiRegister.register(req, res);
});

// Api login
coreApiRoute.post('/login', function (req, res) {
  apiLogin.login(req, res);
});

// Api user info
coreApiRoute.post('/user-info', function (req, res) {
  apiUserInfo.getInfo(req, res);
});

coreApiRoute.post('/user-total-info', function (req, res) {
  apiUserInfo.getTotalInfo(req, res);
});

coreApiRoute.post('/users', function (req, res) {
  apiUserInfo.getUsers(req, res);
});

// Api send
coreApiRoute.post('/send', function (req, res) {
  apiSend.send(req, res);
});

coreApiRoute.post('/send-validate', function (req, res) {
  apiSend.sendValidate(req, res);
});

// Api post test
coreApiRoute.post('/post-test', function (req, res) {
  apiPostTest.postTest(req, res);
});

// Api websocket test
coreApiRoute.post('/websocket-test', function (req, res) {
  apiWebSocketTest.webSocketTest(req, res);
});

// Api transaction output
coreApiRoute.post('/transaction-output', function (req, res) {
  apiTransactionOutput.getOutputData(req, res);
  // apiUserInfo.getInfo(req, res);
});

// Api transaction input
coreApiRoute.post('/transaction-input', function (req, res) {
  apiTransactionInput.getInputData(req, res);
});

module.exports = coreApiRoute;