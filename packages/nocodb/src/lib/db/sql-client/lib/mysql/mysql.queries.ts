const columnListOld = `SELECT
c.table_name as tn,
c.column_name as cn,
c.data_type as dt,
c.column_type as ct,
c.character_maximum_length as clen,
c.numeric_precision as np,
c.numeric_scale as ns,
-- c.datetime_precision as dp,
c.ordinal_position as cop,
c.column_key as ck,
c.extra as ext, -- gives ai
c.column_default as cdf,
c.is_nullable as nrqd,
c.privileges as priv,
c.column_comment as cc,
-- c.generation_expression,
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
c.ordinal_position`;

export default {
  columnList: {
    '55': {
      sql: columnListOld,
      paramsHints: ['databaseName', 'tn', 'databaseName', 'tn'],
    },
    '56': {
      sql: columnListOld,
      paramsHints: ['databaseName', 'tn', 'databaseName', 'tn'],
    },
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
--       c.generation_expression,
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
                      and tc.CONSTRAINT_TYPE != 'UNIQUE'
                      and tc.CONSTRAINT_TYPE != 'FOREIGN KEY'
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
      sql: `create database if not exists ??  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
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
      sql: `SHOW DATABASES LIKE ?`,
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
      rc.DELETE_RULE as dr,
      kcu.table_schema as ts
    FROM
      information_schema.KEY_COLUMN_USAGE AS kcu
    INNER JOIN information_schema.REFERENTIAL_CONSTRAINTS AS rc ON
      kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
    Group by
      kcu.CONSTRAINT_NAME,
      kcu.TABLE_NAME,
      kcu.COLUMN_NAME,
      kcu.POSITION_IN_UNIQUE_CONSTRAINT,
      kcu.REFERENCED_TABLE_NAME,
      kcu.REFERENCED_COLUMN_NAME,
      rc.MATCH_OPTION,
      rc.UPDATE_RULE,
      rc.DELETE_RULE ,
      kcu.table_schema
    Having
      kcu.table_schema = ?
      AND kcu.referenced_column_name IS NOT NULL
      AND kcu.table_name =?`,
      paramsHints: ['database', 'tn'],
    },
  },

  relationListAll: {
    default: {
      sql: `SELECT
      kcu.constraint_name AS cstn,
      kcu.table_name AS tn,
      kcu.column_name AS cn,
      kcu.position_in_unique_constraint AS puc,
      kcu.referenced_table_name AS rtn,
      kcu.referenced_column_name AS rcn,
      rc.match_option AS mo,
      rc.update_rule AS ur,
      rc.delete_rule AS dr,
      kcu.table_schema AS ts
    FROM
      (
      SELECT
        table_schema,
        constraint_name,
        table_name,
        column_name,
        position_in_unique_constraint,
        referenced_table_name,
        referenced_column_name
      FROM
        information_schema.KEY_COLUMN_USAGE
      WHERE
        table_schema = :databaseName) AS kcu
    INNER JOIN
              (
      SELECT
        constraint_schema,
        match_option,
        update_rule,
        delete_rule,
        constraint_name
      FROM
        information_schema.REFERENTIAL_CONSTRAINTS
      WHERE
        constraint_schema = :databaseName) AS rc ON
      kcu.constraint_name = rc.constraint_name
      AND kcu.table_schema = rc.constraint_schema
    INNER JOIN
              (
      SELECT
        table_schema,
        table_name,
        column_name
      FROM
        information_schema.COLUMNS
      WHERE
        table_schema = :databaseName
        AND table_name IN (
        SELECT
          table_name
        FROM
          information_schema.TABLES
        WHERE
          table_schema = :databaseName
          AND Lower(table_type) = 'base table')) AS col ON
      col.table_schema = kcu.table_schema
      AND col.table_name = kcu.table_name
      AND kcu.referenced_column_name IS NOT NULL
    GROUP BY
      cstn ,
      tn ,
      rcn ,
      cn ,
      puc ,
      rtn ,
      cn,
      mo ,
      ur ,
      dr ,
      ts`,
      paramsHints: ['database'],
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
      sql: `SHOW FULL TABLES WHERE TABLE_TYPE LIKE 'VIEW'`,
      paramsHints: [],
    },
  },
};
