"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(client, config) {
    await client
        .query(`
CREATE TABLE IF NOT EXISTS  ${config.database}.api_calls (
    timestamp DateTime,
    workspace_id String,
  	user_id String,
    project_id String,
    url String,
    method String,
    status UInt16,
    exec_time UInt64,
  ) ENGINE = MergeTree
  ORDER BY timestamp
  ;
    `)
        .toPromise();
}
exports.up = up;
async function down(client) { }
exports.down = down;
//# sourceMappingURL=nc_004_api_exec.js.map