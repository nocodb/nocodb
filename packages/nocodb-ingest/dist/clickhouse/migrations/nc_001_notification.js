"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(client, config) {
    var _a;
    await client
        .query(`
CREATE DATABASE IF NOT EXISTS ${(_a = config.database) !== null && _a !== void 0 ? _a : 'nc'};
    `)
        .toPromise();
    await client
        .query(`
      CREATE TABLE IF NOT EXISTS ${config.database}.notification (
          id String(20) NOT NULL,
          body Text,
          type String,
          is_read UInt8 DEFAULT 0,
          is_deleted UInt8 DEFAULT 0,
          fk_user_id String(20),
          created_at DateTime DEFAULT now(),
          PRIMARY KEY (id)
      ) ENGINE = ReplacingMergeTree
      ORDER BY id;
    `)
        .toPromise();
}
exports.up = up;
async function down(client) { }
exports.down = down;
//# sourceMappingURL=nc_001_notification.js.map