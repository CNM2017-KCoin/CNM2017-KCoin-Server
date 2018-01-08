let dbHelper = require('../helpers/db-helper');

exports.test = function (req, res) {
  dbHelper.dbLoadSql(
    `SELECT COUNT(amount) as total_actual_amount
    FROM tb_input_package ip
    WHERE ip.user_id = ?
    AND ip.amount != ?`,
    [
      7,
      0
    ]
  ).then(
    function (actualAmountInfo) {
      // update actual amount on tb_wallet
      dbHelper.dbLoadSql(
        `UPDATE tb_wallet
        SET actual_amount = ?
        WHERE user_id = ?`,
        [
          actualAmountInfo[0]['total_actual_amount'],
          7
        ]
      ).then(
        function (walletInfo) {
          // count send_amount from table tb_transaction and tb_transaction_input
          dbHelper.dbLoadSql(
            `SELECT COUNT(t.send_amount) as total_send_amount
            FROM tb_transaction t
            LEFT JOIN tb_transaction_input ti ON t.id = ti.transaction_id
            WHERE t.status = ?`,
            [
              'waiting'
            ]
          ).then(
            function (sendAmountInfo) {
              // update available amount on tb_wallet
              dbHelper.dbLoadSql(
                `UPDATE tb_wallet
                SET	available_amount = ?
                WHERE user_id = ?`,
                [
                  actualAmountInfo[0]['actual_amount'] - sendAmountInfo[0]['total_send_amount'],
                  7
                ]
              ).then(
                function (walletInfo2) {
                  // do nothing
                }
              );
            }
          );
        }
      );
    }
  );
};















