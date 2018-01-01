let express = require('express');
let coreApiRoute = express.Router();

let apiTest = require('../modules/api-test');

coreApiRoute.get('/test', function(req, res) {
  apiTest.test(req, res);
});


module.exports = coreApiRoute;
