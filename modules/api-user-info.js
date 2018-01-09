let dbHelper = require('../helpers/db-helper');

exports.getInfo = function (req, res) {
  let params = req.body || {};
  let email = params['email'] || '';
  console.log(params);
  dbHelper.dbLoadSql(
    `SELECT id, address
    FROM tb_login l
    WHERE l.email = ?`,
    [
      email
    ]
  ).then(
    function (userInfo) {
      console.log(userInfo);
      if (userInfo[0].id > 0) {
        dbHelper.dbLoadSql(
          `SELECT * 
          FROM tb_wallet w
          WHERE w.user_id = ?`,
          [
            userInfo[0].id
          ]
        ).then(
          function (walletInfo) {
            console.log(walletInfo);
            if (walletInfo[0].id > 0) {
              console.log('111');
              console.log(userInfo[0].address);
              let data = {
                'status': '200',
                'data': {
                  'address':userInfo[0].address,
                  'actual_amount': walletInfo[0].actual_amount,
                  'available_amount': walletInfo[0].available_amount,
                  'report': 'Lấy thông tin thành công!'
                }
              };
              res.send(data);
            } else {
              let data = {
                'status': '500',
                'data': {
                  'error': 'Lấy thông tin wallet thất bại!'
                }
              };
              res.send(data);
            }
          }
        )
      } else {
        let data = {
          'status': '500',
          'data': {
            'error': 'Lấy thông tin user thất bại!'
          }
        };
        res.send(data);
      }
    }
  ).catch(function (error) {
      let data = {
        'status': '500',
        'data': {
          'error': 'Đã có lỗi xảy ra... Vui lòng thử lại!'
        }
      };
      res.send(data);
    }
  );
};

exports.getTotalInfo = function (req, res) {
  let params = req.body || {};
  let email = params['email'] || '';
  console.log(params);
  dbHelper.dbLoadSql(
    `SELECT actual_amount, available_amount
    FROM tb_login l,tb_wallet w
    WHERE l.id = w.user_id`
  ).then(
    function (usersList) {
      console.log(usersList);
      let total_actual_amount = 0;
      let total_available_amount = 0;
      if (usersList.length > 0) {
        for (let i = usersList.length - 1; i >= 0; i--) {
          total_actual_amount += usersList[i].actual_amount;
          total_available_amount += usersList[i].available_amount;
        }

        let data = {
          'status': '200',
          'data': {   
            'total_users': usersList.length,
            'total_actual_amount': total_actual_amount,
            'total_available_amount': total_available_amount,
            'report': 'Lấy thông tin thành công!'
          }
        };
        res.send(data);
      } else {
        let data = {
          'status': '200',
          'data': {
            'total_users': 0,
            'total_actual_amount': 0,
            'total_available_amount': 0,
            'report': 'Giá trị trả về trống!'
          }
        };
        res.send(data);
      }
    }
  ).catch(function (error) {
      let data = {
        'status': '500',
        'data': {
          'error': 'Đã có lỗi xảy ra... Vui lòng thử lại!'
        }
      };
      res.send(data);
    }
  );
};


exports.getUsers = function (req, res) {
  let params = req.body || {};
  let offset = parseInt(params['offset']);
  console.log(offset);
  dbHelper.dbLoadSql(
    `SELECT email, address, actual_amount, available_amount
    FROM tb_login l,tb_wallet w
    WHERE l.id = w.user_id
    LIMIT 10 OFFSET ?`,
    [
      offset*10
    ]
  ).then(
    function (usersList) {
      console.log(usersList);
      let total_actual_amount = 0;
      let total_available_amount = 0;
      if (usersList.length > 0) {
          let data = {
          'status': '200',
          'data': {   
            'users': usersList,
            'report': 'Lấy thông tin thành công!'
          }
        };
        res.send(data);
      } else {
        let data = {
          'status': '200',
          'data': {
            'users': [],
            'report': 'Giá trị trả về trống!'
          }
        };
        res.send(data);
      }
    }
  ).catch(function (error) {
      let data = {
        'status': '500',
        'data': {
          'error': 'Đã có lỗi xảy ra... Vui lòng thử lại!'
        }
      };
      res.send(data);
    }
  );
};

exports.findAddress = function (req, res) {
  let params = req.body || {};
  let email = params['email'] || '';
  let receiver_email = params['receiver_email'] || '';
  dbHelper.dbLoadSql(
    `SELECT id,address 
    FROM tb_login l
    WHERE l.email = ?`,
    [
      receiver_email
    ]
  ).then(
    function (userInfo) {
      let data = [];
      if (userInfo[0]['id'] > 0) {
        let data = {
          'status': '200',
          'data': {
            'address':userInfo[0]['address'],
            'report': 'Tìm kiếm thành công!'
          }
        };
        res.send(data);
      } else {
        let data = {
          'status': '500',
          'data': {
            'error': 'Email không tồn tại!'
          }
        };
        res.send(data);
      }
    }
  ).catch(function (error) {
      let data = {
        'status': '500',
        'data': {
          'error': 'Đã có lỗi xảy ra... Vui lòng thử lại!'
        }
      };
      res.send(data);
    }
  );
};

exports.findRecentEmailList = function (req, res) {
  let params = req.body || {};
  let email = params['email'] || '';
  dbHelper.dbLoadSql(
    `SELECT id 
    FROM tb_login l
    WHERE l.email = ?`,
    [
      email
    ]
  ).then(
    function (userInfo) {
      console.log(userInfo);
      if (userInfo[0]['id'] > 0) {
        dbHelper.dbLoadSql(
          `SELECT old_email
          FROM tb_transaction_old l
          WHERE l.user_id = ?`,
          [
            userInfo[0]['id']
          ]
        ).then(
          function (emailListInfo) { 
            console.log(11111111);
            if(emailListInfo.length > 0) {
              let data = {
                'status': '200',
                'data': {
                  'emailList':emailListInfo,
                  'report': 'Lấy danh sách email thành công!'
                }
              };
              res.send(data);
            } else {
              let data = {
                'status': '200',
                'data': {
                  'emailList':[],
                  'report': 'Không có email giao dịch gần đây!'
                }
              };
              res.send(data);
            }
          }
        ).catch(function (error) {
            let data = {
              'status': '500',
              'data': {
                'error': 'Đã có lỗi xảy ra... Vui lòng thử lại!'
              }
            };
            res.send(data);
          }
        );

      } else {
        let data = {
          'status': '500',
          'data': {
            'error': 'Email không tồn tại!'
          }
        };
        res.send(data);
      }
    }
  ).catch(function (error) {
      let data = {
        'status': '500',
        'data': {
          'error': 'Đã có lỗi xảy ra... Vui lòng thử lại!'
        }
      };
      res.send(data);
    }
  );
};