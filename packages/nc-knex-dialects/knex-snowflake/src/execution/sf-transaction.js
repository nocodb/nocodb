const Transaction = require('knex/lib/execution/transaction');
class Transaction_SF extends Transaction {
  begin(conn) {
    if (this.isolationLevel) {
      return this.query(conn, `BEGIN ISOLATION LEVEL ${this.isolationLevel};`);
    }
    return this.query(conn, 'BEGIN;');
  }
}

module.exports = Transaction_SF;
