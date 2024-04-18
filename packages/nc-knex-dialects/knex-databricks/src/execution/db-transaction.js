const Transaction = require('knex/lib/execution/transaction');

const { timeout, KnexTimeoutError } = require('knex/lib/util/timeout');

class Transaction_DB extends Transaction {
  begin(conn) {
    return this.query(conn, 'BEGIN');
  }

  savepoint(conn) {
    return this.query(conn, `IGNORE`);
  }

  commit(conn, value) {
    return this.query(conn, 'COMMIT', 1, value);
  }

  release(conn, value) {
    return this.query(conn, `IGNORE`, 1, value);
  }

  rollback(conn, error) {
    return this.query(conn, 'ROLLBACK', 2, error);
  }

  rollbackTo(conn, error) {
    return this.query(conn, `ROLLBACK`, 2, error);
  }

  query(conn, sql, status, value) {
    if (sql === 'BEGIN') {
      return Promise.resolve();
    } else if (sql === 'COMMIT') {
      this._resolver(value);
      this._completed = true;
      return Promise.resolve();
    } else if (sql === 'ROLLBACK') {
      if (value === undefined) {
        if (this.doNotRejectOnRollback && /^ROLLBACK\b/i.test(sql)) {
          this._resolver();
          return;
        }

        value = new Error(`Transaction rejected with non-error: ${value}`);
      }
      this._rejecter(value);
      this._completed = true;
      return Promise.resolve();
    } else {
      return Promise.resolve();
    }
  }
}

module.exports = Transaction_DB;
