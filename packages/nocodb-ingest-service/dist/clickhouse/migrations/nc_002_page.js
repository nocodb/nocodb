"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.down = exports.up = void 0;
async function up(client, config) {
    await client
        .query(`
CREATE TABLE IF NOT EXISTS ${config.database}.page (
  id String(20) NOT NULL,
  project_id String(20) NOT NULL,
  fk_workspace_id String(20) NOT NULL,
  title String(150) NOT NULL,
  published_title String(150),
  description String,
  content String,
  published_content String,
  slug String(150) NOT NULL,
  is_parent UInt8 DEFAULT 0,
  parent_page_id String(20),
  is_published UInt8 DEFAULT 0,
  last_published_date DateTime,
  last_published_by_id String(20),
  nested_published_parent_id String(20),
  last_updated_by_id String(20),
  created_by_id String(20) NOT NULL,
  archived_date DateTime,
  archived_by_id String(20),
  metaJson String,
  order Float32,
  icon String,
  created_at DateTime,
  updated_at DateTime,
  PRIMARY KEY (id)
) ENGINE = ReplacingMergeTree
  ORDER BY id;
    `)
        .toPromise();
}
exports.up = up;
async function down(client) { }
exports.down = down;
//# sourceMappingURL=nc_002_page.js.map