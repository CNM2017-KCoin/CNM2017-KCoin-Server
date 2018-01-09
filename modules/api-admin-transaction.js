let dbHelper = require('../helpers/db-helper');

exports.getData = function (req, res) {
  let params = req.body || {};
  let email = params['email'] || '';
  let offset = params['offset'] || '';
  let transaction_data = [];
  dbHelper.dbLoadSql(
    `SELECT COUNT(t.id) as total_transaction
    FROM tb_transaction t
    LEFT JOIN tb_transaction_input ti ON t.id = ti.transaction_id
    WHERE t.id != ?
    OR t.status = ?
    ORDER BY t.created_at DESC`,
    [
      0,
      'waiting'
    ]
  ).then(
    function (TotalTransaction) {
      if (TotalTransaction[0]['total_transaction'] == 0) {
        let data = {
          'status': 200,
          'error': 'Không tồn tại dữ liệu!',
          'data': {
            'total_trans': 0,
            'trans_list': [],
            'limit': 10,
            'offset': offset
          }
        };
        res.send(data);
      }
      dbHelper.dbLoadSql(
        `SELECT t.id, t.created_at, t.send_amount, t.status, ti.ref_hash, t.created_by,
        ti.ref_index, ti.address as sender_address, ti.user_id as sender_id, t.receiver_address
        FROM tb_transaction t
        LEFT JOIN tb_transaction_input ti ON t.id = ti.transaction_id
        WHERE t.id != ?
        OR t.status = ?
        ORDER BY t.created_at DESC
        LIMIT ?
        OFFSET ?`,
        [
          0,
          'waiting',
          10,
          offset * 10
        ]
      ).then(
        function (transIdList) {
          if (transIdList.length == 0) {
            let data = {
              'status': 200,
              'error': 'Không tồn tại dữ liệu phân trang này',
              'data': {
                'total_trans': TotalTransaction[0]['total_transaction'],
                'trans_list': [],
                'limit': 10,
                'offset': offset
              }
            };
            res.send(data);
          }
          let transactionIdList = [];
          for (let i = 0; i < transIdList.length; i++) {
            if (transIdList[i]['status'] == 'creating' || transIdList[i]['status'] == 'fail') {
              let temp = {
                'transaction_id': transIdList[i]['id'],
                'timestamp': transIdList[i]['created_at'],
                'ref_hash': -1,
                'ref_index': -1,
                'sender_email': transIdList[i]['created_by'],
                'sender_address': -1,
                'amount': transIdList[i]['send_amount'],
                'status': transIdList[i]['status'],
                'receiver_id': -1,
                'receiver_address': transIdList[0]['receiver_address']
              };
              transaction_data.push(temp);
            } else {
              transactionIdList.push(transIdList[i]);
            }
          }
          // console.log(transactionIdList);
          if (transactionIdList.length == 0) {
            transaction_data.sort(function (a, b) {
              return b['transaction_id'] - a['transaction_id'];
            });
            let data = {
              'status': 200,
              'report': 'Lấy dữ liệu thành công!',
              'data': {
                'total_trans': TotalTransaction[0]['total_transaction'],
                'trans_list': transaction_data,
                'limit': 10,
                'offset': offset
              }
            };
            res.send(data);
          }
          let condition = transaction_data.length + transactionIdList.length;
          for (let i = 0; i < transactionIdList.length; i++) {
            dbHelper.dbLoadSql(
              `SELECT tto.user_id, tto.address
              FROM tb_transaction_output tto
              WHERE tto.transaction_id = ?`,
              [
                transactionIdList[i]['id']
              ]
            ).then(
              function (outputInfo) {
                // console.log(outputInfo);
                let temp = {
                  'transaction_id': transactionIdList[i]['id'],
                  'timestamp': transactionIdList[i]['created_at'],
                  'ref_hash': transactionIdList[i]['ref_hash'],
                  'ref_index': transactionIdList[i]['ref_index'],
                  'amount': transactionIdList[i]['send_amount'],
                  'sender_id': transactionIdList[i]['sender_id'],
                  'sender_address': transactionIdList[i]['sender_address'],
                  'status': transactionIdList[i]['status'],
                  'receiver_id': outputInfo[0]['user_id'],
                  'receiver_address': transactionIdList[0]['receiver_address'],
                };
                // console.log(111111 + transaction_data.length);
                transaction_data.push(temp);
                // console.log(222222 + TotalTransaction[0]['total_transaction']);

                if (transaction_data.length == condition) {
                  transaction_data.sort(function (a, b) {
                    return b['transaction_id'] - a['transaction_id'];
                  });
                  let data = {
                    'status': 200,
                    'report': 'Lấy dữ liệu thành công!',
                    'data': {
                      'total_trans': TotalTransaction[0]['total_transaction'],
                      'trans_list': transaction_data,
                      'limit': 10,
                      'offset': offset
                    }
                  };
                  res.send(data);
                }
              }
            );
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
  )
};

