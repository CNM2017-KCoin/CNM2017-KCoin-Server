let dbHelper = require('../helpers/db-helper');

exports.getData = function (req, res) {
  let params = req.body || {};
  let email = params['email'] || '';
  let offset = params['offset'] || '';
  let transaction_data = [];
  dbHelper.dbLoadSql(
    `SELECT COUNT(t.id) as total_transaction
    FROM tb_transaction t
    LEFT JOIN tb_transaction_input ti ON t.id = ti.transaction_id`,
    []
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
        `SELECT t.id, t.created_at, t.send_amount, t.status, ti.ref_hash, 
        ti.ref_index, ti.address as sender_address, ti.user_id as sender_id
        FROM tb_transaction t
        LEFT JOIN tb_transaction_input ti ON t.id = ti.transaction_id
        LIMIT ?
        OFFSET ?`,
        [
          10,
          offset * 10
        ]
      ).then(
        function (transactionIdList) {
          if (transactionIdList.length == 0) {
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
                let temp = {
                  'transaction_id': transactionIdList[i]['id'],
                  'timestamp': transactionIdList[0]['created_at'],
                  'ref_hash': transactionIdList[0]['ref_hash'],
                  'ref_index': transactionIdList[0]['ref_index'],
                  'amount': transactionIdList[0]['send_amount'],
                  'sender_id': transactionIdList[0]['sender_id'],
                  'sender_address': transactionIdList[0]['sender_address'],
                  'amount': transactionIdList[0]['send_amount'],
                  'status': transactionIdList[0]['status'],
                  'receiver_id': outputInfo[0]['user_id'],
                  'receiver_address': outputInfo[0]['address'],
                };
                transaction_data.push(temp);
                if (transaction_data.length == TotalTransaction[0]['total_transaction']) {
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
  );;

};

