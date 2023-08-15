CREATE TABLE IF NOT EXISTS nc_notification (
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
