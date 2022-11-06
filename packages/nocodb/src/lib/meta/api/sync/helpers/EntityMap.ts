import sqlite3 from 'better-sqlite3';
import { Readable } from 'stream';

class EntityMap {
  cols: string[];
  db: any;

  constructor(...args) {
    this.cols = args.map((arg) => processKey(arg));
    this.db = new sqlite3(':memory:');

    const colStatement =
      this.cols.length > 0
        ? this.cols.join(' TEXT, ') + ' TEXT'
        : 'mappingPlaceholder TEXT';
    const stmt = this.db.prepare(`CREATE TABLE mapping (${colStatement})`);
    stmt.run();
  }

  destroy() {
    if (this.db) {
      this.db.close();
    }
  }

  addRow(row): void {
    const cols = Object.keys(row).map((key) => processKey(key));
    const colStatement = cols.map((key) => `'${key}'`).join(', ');
    const questionMarks = cols.map(() => '?').join(', ');

    for (const col of cols.filter((col) => !this.cols.includes(col))) {
      try {
        const stmt = this.db.prepare(`ALTER TABLE mapping ADD '${col}' TEXT;`);
        stmt.run();
        this.cols.push(col);
      } catch (e) {
        console.log(e);
      }
    }

    const values = Object.values(row).map((val) => {
      if (typeof val === 'object' || typeof val === 'boolean') {
        return `JSON::${JSON.stringify(val)}`;
      }
      return `${val}`;
    });

    try {
      const stmt = this.db.prepare(
        `INSERT INTO mapping (${colStatement}) VALUES (${questionMarks})`
      );
      stmt.run(values);
    } catch (e) {
      console.log(colStatement);
      console.log(values);
      console.log(e);
    }
  }

  getRow(col, val, res = []): Record<string, any> {
    col = processKey(col);
    res = res.map((r) => processKey(r));

    try {
      const stmt = this.db.prepare(
        `SELECT ${res.length ? res.join(', ') : '*'} FROM mapping WHERE ${col} = ?`
      );
      const row = stmt.get(val);
      return processResponseRow(row);
    } catch (e) {
      console.log(e);
      return null;
    }
  }

  getCount(): number {
    try {
      const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM mapping`);
      const row = stmt.get();
      return row.count;
    } catch (e) {
      console.log(e);
      return 0;
    }
  }

  getStream(res = []): DBStream {
    res = res.map((r) => processKey(r));
    return new DBStream(
      this.db,
      `SELECT ${res.length ? res.join(', ') : '*'} FROM mapping`
    );
  }

  getLimit(limit, offset, res = []): Record<string, any>[] {
    try {
      const stmt = this.db.prepare(
        `SELECT ${res.length ? res.join(', ') : '*'} FROM mapping LIMIT ${limit} OFFSET ${offset}`
      );
      const rows = stmt.all();
      return rows.map(processResponseRow);
    } catch (e) {
      console.log(e);
      return [];
    }
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
  }

  _read() {
    let stream = this;
    for (const row of this.stmt.iterate()) {
      stream.push(processResponseRow(row));
    }
    stream.push(null);
  }
}

function processResponseRow(res?: any) {
  if (!res) return null;
  for (const key of Object.keys(res)) {
    if (res[key] && res[key].startsWith('JSON::')) {
      try {
        res[key] = JSON.parse(res[key].replace('JSON::', ''));
      } catch (e) {
        console.log(e);
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
