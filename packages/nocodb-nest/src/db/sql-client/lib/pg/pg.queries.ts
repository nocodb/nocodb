// https://www.postgresql.org/docs/9.5/datatype.html

const pgQueries = {
  columnList: {
    default: {
      sql: `SELECT
      c.table_name as tn,
      c.column_name as cn,
      c.data_type as dt,
      c.column_type as ct,
      c.character_maximum_length as clen,
      c.numeric_precision as np,
      c.numeric_scale as ns,
      c.datetime_precision as dp,
      c.ordinal_position as cop,
      c.column_key as ck,
      c.extra as ext, -- gives ai
      c.column_default as cdf,
      c.is_nullable as nrqd,
      c.privileges as priv,
      c.column_comment as cc,
      c.generation_expression,
      c.character_set_name as csn,
      c.collation_name as clnn,
      ct.CONSTRAINT_TYPE as cst
    FROM
      information_schema.COLUMNS as c
    Left join(
              select
                      tc.CONSTRAINT_NAME,
                      tc.TABLE_NAME,
                      tc.CONSTRAINT_SCHEMA,
                      tc.CONSTRAINT_TYPE,
                      s.COLUMN_NAME
              from
                      information_schema.TABLE_CONSTRAINTS as tc
              LEFT JOIN information_schema.STATISTICS as s ON
                      s.table_schema = tc.CONSTRAINT_SCHEMA
                      and s.TABLE_NAME = tc.TABLE_NAME
                      and s.INDEX_NAME = tc.CONSTRAINT_NAME
              where
                      tc.CONSTRAINT_SCHEMA = ?
                      and s.TABLE_NAME = ? 
      ) ct on
      c.TABLE_SCHEMA = ct.CONSTRAINT_SCHEMA
      AND c.TABLE_NAME = ct.TABLE_NAME
      AND c.COLUMN_NAME = ct.COLUMN_NAME
    WHERE
      c.table_schema = ?
      and c.TABLE_NAME = ?
    ORDER BY
      c.table_name,
      c.ordinal_position`,
      paramsHints: ['databaseName', 'tn', 'databaseName', 'tn'],
    },
  },
  constraintList: {
    default: {
      sql: `SELECT 
      k.constraint_name as cstn, 
      k.column_name as cn, 
      k.ordinal_position as op, 
      k.position_in_unique_constraint as puc, 
      t.constraint_type as cst
FROM information_schema.table_constraints t
LEFT JOIN information_schema.key_column_usage k
USING(constraint_name,table_schema,table_name)
WHERE
t.table_schema=?
AND t.table_name=?;`,
      paramsHints: ['database', 'tn'],
    },
  },
  createDatabaseIfNotExists: {
    default: {
      sql: `create database if not exists ??`,
      paramsHints: ['database'],
    },
  },
  createTableIfNotExists: {
    default: {
      sql: ``,
      paramsHints: [],
    },
  },

  dropDatabase: {
    default: {
      sql: `drop database ??`,
      paramsHints: ['database'],
    },
  },
  databaseList: {
    default: {
      sql: `SHOW databases`,
      paramsHints: [],
    },
  },

  hasDatabase: {
    default: {
      sql: `SHOW DATABASES LIKE ??`,
      paramsHints: ['databaseName'],
    },
  },
  indexList: {
    default: {
      sql: `show index from ??`,
      paramsHints: ['tn'],
    },
  },

  functionList: {
    default: {
      sql: `show function status where db=?`,
      paramsHints: ['databaseName'],
    },
  },
  functionRead: {
    default: {
      sql: `SHOW CREATE FUNCTION ??`,
      paramsHints: ['function_name'],
    },
  },
  functionDelete: {
    default: {
      sql: `DROP FUNCTION IF EXISTS ??`,
      paramsHints: ['function_name'],
    },
  },

  procedureList: {
    default: {
      sql: `show procedure status where db=?`,
      paramsHints: ['databaseName'],
    },
  },
  procedureRead: {
    default: {
      sql: `show create procedure ??`,
      paramsHints: ['procedure_name'],
    },
  },
  procedureDelete: {
    default: {
      sql: `DROP PROCEDURE IF EXISTS ??`,
      paramsHints: ['procedure_name'],
    },
  },

  relationList: {
    default: {
      sql: `SELECT
      kcu.CONSTRAINT_NAME as cstn,
      kcu.TABLE_NAME as tn,
      kcu.COLUMN_NAME as cn,
      kcu.POSITION_IN_UNIQUE_CONSTRAINT as puc,
      kcu.REFERENCED_TABLE_NAME as rtn,
      kcu.REFERENCED_COLUMN_NAME as rcn,
      rc.MATCH_OPTION as mo,
      rc.UPDATE_RULE as ur,
      rc.DELETE_RULE as dr
    FROM
      information_schema.\`KEY_COLUMN_USAGE\` AS kcu
    INNER JOIN information_schema.REFERENTIAL_CONSTRAINTS AS rc ON
      kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
    WHERE
      kcu.table_schema = ?
      AND kcu.referenced_column_name IS NOT NULL
      AND kcu.table_name=?`,
      paramsHints: ['database', 'tn'],
    },
  },

  schemaCreate: {
    default: {
      sql: `create database ??`,
      paramsHints: ['database_name'],
    },
  },
  schemaDelete: {
    default: {
      sql: `drop database ??`,
      paramsHints: ['database_name'],
    },
  },
  triggerList: {
    default: {
      sql: `SHOW TRIGGERS like ?`,
      paramsHints: ['tn'],
    },
  },
  tableList: {
    default: {
      sql: ``,
      paramsHints: [],
    },
  },
  testConnection: {
    default: {
      sql: ``,
      paramsHints: [],
    },
  },
  triggerRead: {
    default: {
      sql: `SHOW FULL TABLES IN ?? WHERE TABLE_TYPE LIKE 'VIEW';`,
      paramsHints: ['databaseName'],
    },
  },
  triggerDelete: {
    default: {
      sql: `DROP TRIGGER ??`,
      paramsHints: ['trigger_name'],
    },
  },
  version: {
    default: {
      sql: ``,
      paramsHints: [],
    },
  },
  viewRead: {
    default: {
      sql: `select * FROM INFORMATION_SCHEMA.VIEWS WHERE
       TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      paramsHints: ['databaseName', 'view_name'],
    },
  },
  //
  viewList: {
    default: {
      sql: `SHOW FULL TABLES IN ?? WHERE TABLE_TYPE LIKE 'VIEW'`,
      paramsHints: ['databaseName'],
    },
  },
};

export default pgQueries;
