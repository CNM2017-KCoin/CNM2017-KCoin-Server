let dbHelper = require('../helpers/db-helper');

exports.getOutputData = function (req, res) {
  let params = req.body || {};
  let email = params['email'] || '';
  let password = params['password'] || '';
  let offset = params['offset'] || '';
  let sender_data = [];
  dbHelper.dbLoadSql(
    `SELECT l.id, l.role, status
    FROM tb_login l
    WHERE l.email = ?
    AND l.password = ?`,
    [
      email,
      password
    ]
  ).then(
    function (userInfo) {
      if (userInfo.length < 1 || userInfo[0]['status'] == 0) {
        let data = {
          'status': '500',
          'data': {
            'error': 'Bạn không có quyền truy cập!'
          }
        };
        res.send(data);
      }
      // console.log(1111111);
      if (userInfo[0]['id'] < 1) {
        let data = {
          'status': 200,
          'error': 'User không tồn tại!',
          'data': {
            'total_sender_trans': 0,
            'sender_trans': [],
            'limit': 10,
            'offset': offset
          }
        };
        res.send(data);
      }
      if (userInfo[0]['id'] > 0) {
        // console.log(2222222);
        dbHelper.dbLoadSql(
          `SELECT COUNT(t.id) as total_send
          FROM tb_transaction t
          LEFT JOIN tb_transaction_input ti ON t.id = ti.transaction_id
          WHERE ti.user_id = ?
          OR t.created_by = ?`,
          [
            userInfo[0]['id'],
            email
          ]
        ).then(
          function (TotalSend) {
            // console.log(33333333);
            if (TotalSend[0]['total_send'] < 1) {
              let data = {
                'status': 200,
                'error': 'Không tồn tại dữ liệu!',
                'data': {
                  'total_sender_trans': 0,
                  'sender_trans': [],
                  'limit': 10,
                  'offset': offset
                }
              };
              res.send(data);
            }
            dbHelper.dbLoadSql(
              `SELECT t.id, t.created_at, t.send_amount, t.status, t.receiver_address
              FROM tb_transaction t
              LEFT JOIN tb_transaction_input ti ON t.id = ti.transaction_id
              WHERE ti.user_id = ?
              OR t.created_by = ?
              ORDER BY t.created_at DESC
              LIMIT ?
              OFFSET ?`,
              [
                userInfo[0]['id'],
                email,
                10,
                offset * 10
              ]
            ).then(
              function (transIdList) {
                // console.log(44444444);
                if (transIdList.length < 1) {
                  let data = {
                    'status': 200,
                    'error': 'Không tồn tại dữ liệu phân trang này',
                    'data': {
                      'total_sender_trans': TotalSend[0]['total_send'],
                      'sender_trans': [],
                      'limit': 10,
                      'offset': offset
                    }
                  };
                  res.send(data);
                }
                //, t.created_at, t.send_amount, t.status
                let transactionIdList = [];
                for (let i = 0; i < transIdList.length; i++) {
                  // console.log(555555);
                  if (transIdList[i]['status'] == 'creating' || transIdList[i]['status'] == 'fail') {
                    let temp = {
                      'transaction_id': transIdList[i]['id'],
                      'timestamp': transIdList[i]['created_at'],
                      'amount': transIdList[i]['send_amount'],
                      'status': transIdList[i]['status'],
                      'receiver_id': -1,
                      'receiver_address': transIdList[i]['receiver_address'],
                    };
                    sender_data.push(temp);
                  } else {
                    transactionIdList.push(transIdList[i]);
                  }
                }
                if (transactionIdList.length == 0) {
                  sender_data.sort(function (a, b) {
                    return b['transaction_id'] - a['transaction_id'];
                  });
                  let data = {
                    'status': 200,
                    'report': 'Lấy dữ liệu thành công!',
                    'data': {
                      'total_sender_trans': TotalSend[0]['total_send'],
                      'sender_trans': sender_data,
                      'limit': 10,
                      'offset': offset
                    }
                  };
                  res.send(data);
                }
                let condition = sender_data.length + transactionIdList.length;
                for (let i = 0; i < transactionIdList.length; i++) {

                  // console.log(6666666);
                  dbHelper.dbLoadSql(
                    `SELECT tto.user_id, tto.address
                    FROM tb_transaction_output tto
                    WHERE tto.transaction_id = ?
                    AND tto.user_id != ?`,
                    [
                      transactionIdList[i]['id'],
                      userInfo[0]['id']
                    ]
                  ).then(
                    function (outputInfo) {
                      if (outputInfo.length < 1) {
                        console.log(777777777);
                        let data = {
                          'status': 200,
                          'report': 'Không tồn tại giao dịch!',
                          'data': {
                            'total_sender_trans': 0,
                            'sender_trans': [],
                            'limit': 10,
                            'offset': offset
                          }
                        };
                        res.send(data);
                      }
                      let temp = {
                        'transaction_id': transactionIdList[i]['id'],
                        'timestamp': transactionIdList[i]['created_at'],
                        'amount': transactionIdList[i]['send_amount'],
                        'status': transactionIdList[i]['status'],
                        'receiver_id': outputInfo[0]['user_id'],
                        'receiver_address': outputInfo[0]['address'],
                      };
                      sender_data.push(temp);
                      // console.log('11233323');


                      if ((sender_data.length == condition)) {
                        sender_data.sort(function (a, b) {
                          return b['transaction_id'] - a['transaction_id'];
                        });
                        let data = {
                          'status': 200,
                          'report': 'Lấy dữ liệu thành công!',
                          'data': {
                            'total_sender_trans': TotalSend[0]['total_send'],
                            'sender_trans': sender_data,
                            'limit': 10,
                            'offset': offset
                          }
                        };
                        res.send(data);
                      }
                    }
                  ).catch(function (error) {
                      let data = {
                        'status': '500',
                        'data': {
                          'error': 'Đã có lỗi xảy ra... Vui lòng thử lại 3!'
                        }
                      };
                      res.send(data);
                    }
                  );
                }
              }
            ).catch(function (error) {
                let data = {
                  'status': '500',
                  'data': {
                    'error': 'Đã có lỗi xảy ra... Vui lòng thử lại 3!'
                  }
                };
                res.send(data);
              }
            );
          }
        ).catch(function (error) {
            let data = {
              'status': '500',
              'data': {
                'error': 'Đã có lỗi xảy ra... Vui lòng thử lại 2!'
              }
            };
            res.send(data);
          }
        );
      }
    }
  ).catch(function (error) {
      let data = {
        'status': '500',
        'data': {
          'error': 'Đã có lỗi xảy ra... Vui lòng thử lại 1!'
        }
      };
      res.send(data);
    }
  );
};

