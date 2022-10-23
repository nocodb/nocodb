import sqlite3 from 'sqlite3';
import { Readable } from 'stream';

class EntityMap {
  initialized: boolean;
  cols: string[];
  db: any;

  constructor(...args) {
    this.initialized = false;
    this.cols = args;
    this.db = new Promise((resolve, reject) => {
      const db = new sqlite3.Database(':memory:');

      const colStatement = this.cols.length > 0 ? this.cols.join(' TEXT, ') + ' TEXT' : 'mappingPlaceholder TEXT';
      db.run(`CREATE TABLE mapping (${colStatement})`, (err) => {
        if (err) {
          console.log(err);
          reject(err);
        }
        resolve(db)
      });
    });
  }

  async init () {
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
    
    const colStatement = Object.keys(row).map((key) => `'${key.replace(/'/gi, "''")}'`).join(', ');
    const questionMarks = Object.keys(row).map(() => '?').join(', ');
    
    const promises = [];

    for (const col of Object.keys(row).filter((col) => !this.cols.includes(col))) {
      promises.push(new Promise((resolve, reject) => {
        this.db.run(`ALTER TABLE mapping ADD '${col.replace(/'/gi, "''")}' TEXT;`, (err) => {
          if (err) {
            console.log(err);
            reject(err);
          }
          this.cols.push(col);
          resolve(true);
        });
      }));
    }

    await Promise.all(promises);

    const values =  Object.values(row).map((val) => {
      if (typeof val === 'object') {
        return `JSON::${JSON.stringify(val)}`;
      }
      return val;
    });

    return new Promise((resolve, reject) => {
      this.db.run(`INSERT INTO mapping (${colStatement}) VALUES (${questionMarks})`, values, (err) => {
        if (err) {
          console.log(err);
          reject(err);
        }
        resolve(true);
      });
    });
  }

  getRow(col, val, res = []): Promise<Record<string, any>> {
    if (!this.initialized) {
      throw 'Please initialize first!';
    }
    return new Promise((resolve, reject) => {
      this.db.get(`SELECT ${res.length ? res.join(', ') : '*'} FROM mapping WHERE ${col} = ?`, [val], (err, rs) => {
        if (err) {
          console.log(err);
          reject(err);
        }
        if (rs) {
          for (const key of Object.keys(rs)) {
            if (rs[key] && rs[key].startsWith('JSON::')) {
              try {
                rs[key] = JSON.parse(rs[key].replace('JSON::', ''));
              } catch (e) {
                console.log(e);
              }
            }
          }
        }
        resolve(rs)
      });
    });
  }

  getCount(): Promise<number> {
    if (!this.initialized) {
      throw 'Please initialize first!';
    }
    return new Promise((resolve, reject) => {
      this.db.get(`SELECT COUNT(*) as count FROM mapping`, (err, rs) => {
        if (err) {
          console.log(err);
          reject(err);
        }
        resolve(rs.count)
      });
    });
  }

  getStream(res = []): DBStream {
    if (!this.initialized) {
      throw 'Please initialize first!';
    }
    return new DBStream(this.db, `SELECT ${res.length ? res.join(', ') : '*'} FROM mapping`);
  }

  getLimit(limit, offset, res = []): Promise<Record<string, any>[]> {
    if (!this.initialized) {
      throw 'Please initialize first!';
    }
    return new Promise((resolve, reject) => {
      this.db.all(`SELECT ${res.length ? res.join(', ') : '*'} FROM mapping LIMIT ${limit} OFFSET ${offset}`, (err, rs) => {
        if (err) {
          console.log(err);
          reject(err);
        }
        for (const row of rs) {
          for (const key of Object.keys(row)) {
            if (row[key] && row[key].startsWith('JSON::')) {
              try {
                row[key] = JSON.parse(row[key].replace('JSON::', ''));
              } catch (e) {
                console.log(e);
              }
            }
          }
        }
        resolve(rs)
      });
    });
  }
}

class DBStream extends Readable {
  db: any;
  stmt: any;
  sql: any;

  constructor(db, sql) {
    super({ objectMode: true});
    this.db = db;
    this.sql = sql;
    this.stmt = this.db.prepare(this.sql);
    this.on('end', () => this.stmt.finalize());
  }

  _read() {
    let stream = this;
    this.stmt.get(function (err, result) {
      if (err) {
        stream.emit('error', err);
      } else {
        if (result) {
          for (const key of Object.keys(result)) {
            if (result[key] && result[key].startsWith('JSON::')) {
              try {
                result[key] = JSON.parse(result[key].replace('JSON::', ''));
              } catch (e) {
                console.log(e);
              }
            }
          }
        }
        stream.push(result || null)
      }
    });
  }
}

export default EntityMap;
