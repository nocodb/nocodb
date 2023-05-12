"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(client, config) {
    await client
        .query(`
CREATE TABLE IF NOT EXISTS ${config.database}.api_count (
  id UUID,
  fk_workspace_id String(20) NOT NULL,
  api_token String(150) NOT NULL,
  count UInt64 NOT NULL DEFAULT 0,
  exec_time UInt64 NOT NULL DEFAULT 0,
  ttl UInt64 NOT NULL DEFAULT 0,
  max_apis UInt64 NOT NULL DEFAULT 0, 
  created_at DateTime,
  PRIMARY KEY (id) 
) ENGINE = MergeTree;
    `)
        .toPromise();
}
exports.up = up;
async function down(client) { }
exports.down = down;
//# sourceMappingURL=nc_003_api_count.js.map