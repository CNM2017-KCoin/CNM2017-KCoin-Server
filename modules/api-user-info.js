let dbHelper = require('../helpers/db-helper');

exports.getInfo = function (req, res) {
  let params = req.body || {};
  let email = params['email'] || '';
  console.log(params);
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
              console.log('111111');
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