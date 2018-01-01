var express = require('express');
var coreApiRoute = express.Router();

coreApiRoute.get('/test', function(req, res) {
  let data = {
    'status': '1',
    'error': "test success",
    'data': []
  };
  res.send(data);
});
module.exports = coreApiRoute;
