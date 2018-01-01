let express = require('express');
let coreApiRoute = express.Router();

let apiTest = require('../modules/api-test');
let apiRegister = require('../modules/api-register');

coreApiRoute.get('/test', function(req, res) {
  apiTest.test(req, res);
});

// Api register
coreApiRoute.post('/register', function(req, res) {
  apiRegister.register(req, res);
});

module.exports = coreApiRoute;
