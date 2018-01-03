const WebSocket = require('ws');
const ws = new WebSocket('wss://api.kcoin.club/');
var schedule = require('node-schedule');
//var Block = require('../models/BLock');

ws.onopen = function () {
  console.log('connected');
};

ws.onmessage = function (response) {
  let data = JSON.parse(response.data)
  /*console.log('111111111111111111');
  console.log('incoming data', data);
  console.log('222222222222222222222222');
  console.log('Extract data', data.data);
  console.log('33333333333333333333333333');
  console.log('Trans data', data.data.transactions);*/

  /* Block.addNewBlockItem(data.data, (err, rls)=>{
     // console.log(rls)
   })*/
};

var secondlyJob = schedule.scheduleJob('*/5 * * * * *', function () {
  ws.send('abc')
});

exports.Listen = function (req, res, next) {
  ws.onopen
  ws.onmessage
  next()
}