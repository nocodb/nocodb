import { Readable } from 'stream';
import sqlite3 from 'sqlite3';
import { Logger } from '@nestjs/common';

const logger = new Logger('EntityMap');

class EntityMap {
  initialized: boolean;
  cols: string[];
  db: any;

  constructor(...args) {
    this.initialized = false;
    this.cols = args.map((arg) => processKey(arg));
    this.db = new Promise((resolve, reject) => {
      const db = new sqlite3.Database(':memory:');

      const colStatement =
        this.cols.length > 0
          ? this.cols.join(' TEXT, ') + ' TEXT'
          : 'mappingPlaceholder TEXT';
      db.run(`CREATE TABLE mapping (${colStatement})`, (err) => {
        if (err) {
          logger.log(err);
          reject(err);
        }
        resolve(db);
      });
    });
  }

  async init() {
    if (!this.initialized) {
      this.db = await this.db;
      this.initialized = true;
    }
  }

  destroy() {
    if (this.initialized && this.db) {
      this.db.close();
    }
  }

  async addRow(row) {
    if (!this.initialized) {
      throw 'Please initialize first!';
    }

    const cols = Object.keys(row).map((key) => processKey(key));
    const colStatement = cols.map((key) => `'${key}'`).join(', ');
    const questionMarks = cols.map(() => '?').join(', ');

    const promises = [];

    for (const col of cols.filter((col) => !this.cols.includes(col))) {
      promises.push(
        new Promise((resolve, reject) => {
          this.db.run(`ALTER TABLE mapping ADD '${col}' TEXT;`, (err) => {
            if (err) {
              logger.log(err);
              reject(err);
            }
            this.cols.push(col);
            resolve(true);
          });
        }),
      );
    }

    await Promise.all(promises);

    const values = Object.values(row).map((val) => {
      if (typeof val === 'object') {
        return `JSON::${JSON.stringify(val)}`;
      }
      return val;
    });

    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO mapping (${colStatement}) VALUES (${questionMarks})`,
        values,
        (err) => {
          if (err) {
            logger.log(err);
            reject(err);
          }
          resolve(true);
        },
      );
    });
  }

  getRow(col, val, res = []): Promise<Record<string, any>> {
    if (!this.initialized) {
      throw 'Please initialize first!';
    }
    return new Promise((resolve, reject) => {
      col = processKey(col);
      res = res.map((r) => processKey(r));
      this.db.get(
        `SELECT ${
          res.length ? res.join(', ') : '*'
        } FROM mapping WHERE ${col} = ?`,
        [val],
        (err, rs) => {
          if (err) {
            logger.log(err);
            reject(err);
          }
          if (rs) {
            rs = processResponseRow(rs);
          }
          resolve(rs);
        },
      );
    });
  }

  getCount(): Promise<number> {
    if (!this.initialized) {
      throw 'Please initialize first!';
    }
    return new Promise((resolve, reject) => {
      this.db.get(`SELECT COUNT(*) as count FROM mapping`, (err, rs) => {
        if (err) {
          logger.log(err);
          reject(err);
        }
        resolve(rs.count);
      });
    });
  }

  getStream(res = []): DBStream {
    if (!this.initialized) {
      throw 'Please initialize first!';
    }
    res = res.map((r) => processKey(r));
    return new DBStream(
      this.db,
      `SELECT ${res.length ? res.join(', ') : '*'} FROM mapping`,
    );
  }

  getLimit(limit, offset, res = []): Promise<Record<string, any>[]> {
    if (!this.initialized) {
      throw 'Please initialize first!';
    }
    return new Promise((resolve, reject) => {
      res = res.map((r) => processKey(r));
      this.db.all(
        `SELECT ${
          res.length ? res.join(', ') : '*'
        } FROM mapping LIMIT ${limit} OFFSET ${offset}`,
        (err, rs) => {
          if (err) {
            logger.log(err);
            reject(err);
          }
          for (let row of rs) {
            row = processResponseRow(row);
          }
          resolve(rs);
        },
      );
    });
  }
}

class DBStream extends Readable {
  db: any;
  stmt: any;
  sql: any;

  constructor(db, sql) {
    super({ objectMode: true });
    this.db = db;
    this.sql = sql;
    this.stmt = this.db.prepare(this.sql);
    this.on('end', () => this.stmt.finalize());
  }

  _read() {
    const stream = this;
    this.stmt.get(function (err, result) {
      if (err) {
        stream.emit('error', err);
      } else {
        if (result) {
          result = processResponseRow(result);
        }
        stream.push(result || null);
      }
    });
  }
}

function processResponseRow(res: any) {
  for (const key of Object.keys(res)) {
    if (res[key] && res[key].startsWith('JSON::')) {
      try {
        res[key] = JSON.parse(res[key].replace('JSON::', ''));
      } catch (e) {
        logger.log(e);
      }
    }
    if (revertKey(key) !== key) {
      res[revertKey(key)] = res[key];
      delete res[key];
    }
  }
  return res;
}

function processKey(key) {
  return key.replace(/'/g, "''").replace(/[A-Z]/g, (match) => `_${match}`);
}

function revertKey(key) {
  return key.replace(/''/g, "'").replace(/_[A-Z]/g, (match) => match[1]);
}

export default EntityMap;
