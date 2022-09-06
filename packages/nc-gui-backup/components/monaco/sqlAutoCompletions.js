export default function(monaco) {
  return [
    {
      insertText: 'ALTER ',
      label: 'ALTER',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation:
        'Used to add, delete, modify columns, add and drop various constraints in an existing table.'
    },
    {
      insertText: 'CREATE ',
      label: 'CREATE',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'Create a new table in a database'
    },
    {
      insertText: 'DROP ',
      label: 'DROP',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'Drop an existing SQL database'
    },
    {
      insertText: 'GRANT ',
      label: 'GRANT',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'Define privileges and role authorizations'
    },
    {
      insertText: 'REVOKE ',
      label: 'REVOKE',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'Destroy privileges and role authorizations'
    },
    {
      insertText: 'CLOSE ',
      label: 'CLOSE',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'Close a cursor'
    },
    {
      insertText: 'DECLARE ',
      label: 'DECLARE',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'Define a cursor'
    },
    {
      insertText: 'FETCH ',
      label: 'FETCH',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation:
        'Position a cursor on a specified row of a table and retrieve values from that row'
    },
    {
      insertText: 'FREE ',
      label: 'FREE',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation:
        'Remove the association between a locator variable and the value that is represented by that locator'
    },
    {
      insertText: 'HOLD ',
      label: 'HOLD',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'Mark a locator variable as being holdable'
    },
    {
      insertText: 'OPEN ',
      label: 'OPEN',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'Open a cursor'
    },
    {
      insertText: 'SELECT ',
      label: 'SELECT',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'Retrieve values from a table'
    },
    {
      insertText: 'DELETE ',
      label: 'DELETE',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'Delete existing records in a table'
    },
    {
      insertText: 'INSERT ',
      label: 'INSERT',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'Insert new records in a table'
    },
    {
      insertText: 'UPDATE ',
      label: 'UPDATE',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'Modify the existing records in a table'
    },
    {
      insertText: 'COMMIT ',
      label: 'COMMIT',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'Terminate the current SQL-transaction with commit'
    },
    {
      insertText: 'RELEASE ',
      label: 'RELEASE',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'Destroy a savepoint'
    },
    {
      insertText: 'ROLLBACK ',
      label: 'ROLLBACK',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation:
        'Terminate the current SQL-transaction with rollback, or rollback all actions affecting SQL-data and/or schemas since the establishment of a savepoint'
    },
    {
      insertText: 'SAVEPOINT ',
      label: 'SAVEPOINT',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'Establish a savepoint'
    },
    {
      insertText: 'SET ',
      label: 'SET',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'Set something'
    },
    {
      insertText: 'START ',
      label: 'START',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'Start an SQL-transaction and set its characteristics'
    },
    {
      insertText: 'CONNECT ',
      label: 'CONNECT',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'Establish an SQL-session'
    },
    {
      insertText: 'DISCONNECT ',
      label: 'DISCONNECT',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'Terminate an SQL-session'
    },
    {
      insertText: 'CALL ',
      label: 'CALL',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'Invoke an SQL-invoked routine'
    },
    {
      insertText: 'RETURN ',
      label: 'RETURN',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'Return a value from a SQL function'
    },
    {
      insertText: 'GET ',
      label: 'GET',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation:
        'Get exception or completion condition information from the diagnostics area'
    },
    {
      insertText: 'ALL ',
      label: 'ALL',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'TRUE if all of the subquery values meet the condition'
    },
    {
      insertText: 'AND ',
      label: 'AND',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'TRUE if all the conditions separated by AND are TRUE'
    },
    {
      insertText: 'ANY ',
      label: 'ANY',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'TRUE if any of the subquery values meet the condition'
    },
    {
      insertText: 'BETWEEN ',
      label: 'BETWEEN',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'TRUE if the operand is within the range of comparisons'
    },
    {
      insertText: 'EXISTS ',
      label: 'EXISTS',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'TRUE if the subquery returns one or more records'
    },
    {
      insertText: 'IN ',
      label: 'IN',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation:
        'TRUE if the operand is equal to one of a list of expressions'
    },
    {
      insertText: 'LIKE ',
      label: 'LIKE',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'TRUE if the operand matches a pattern'
    },
    {
      insertText: 'NOT ',
      label: 'NOT',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'Displays a record if the condition(s) is NOT TRUE'
    },
    {
      insertText: 'OR ',
      label: 'OR',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'TRUE if any of the conditions separated by OR is TRUE'
    },
    {
      insertText: 'SOME ',
      label: 'SOME',
      kind: monaco.languages.CompletionItemKind.Keyword,
      documentation: 'TRUE if any of the subquery values meet the condition'
    },
    {
      label: 'ABS',
      insertText: 'ABS '
    },
    {
      label: 'ABSOLUTE',
      insertText: 'ABSOLUTE '
    },
    {
      label: 'ACTION',
      insertText: 'ACTION '
    },
    {
      label: 'ADA',
      insertText: 'ADA '
    },
    {
      label: 'ADD',
      insertText: 'ADD '
    },
    {
      label: 'ADMIN',
      insertText: 'ADMIN '
    },
    {
      label: 'AFTER',
      insertText: 'AFTER '
    },
    {
      label: 'AGGREGATE',
      insertText: 'AGGREGATE '
    },
    {
      label: 'ALIAS',
      insertText: 'ALIAS '
    },
    {
      label: 'ALL',
      insertText: 'ALL '
    },
    {
      label: 'ALLOCATE',
      insertText: 'ALLOCATE '
    },
    {
      label: 'ALTER',
      insertText: 'ALTER '
    },
    {
      label: 'ALTER DOMAIN',
      insertText: 'ALTER DOMAIN '
    },
    {
      label: 'ALTER ROUTINE',
      insertText: 'ALTER ROUTINE '
    },
    {
      label: 'ALTER TABLE',
      insertText: 'ALTER TABLE '
    },
    {
      label: 'ALTER TYPE',
      insertText: 'ALTER TYPE '
    },
    {
      label: 'AND',
      insertText: 'AND '
    },
    {
      label: 'ANY',
      insertText: 'ANY '
    },
    {
      label: 'ARE',
      insertText: 'ARE '
    },
    {
      label: 'ARRAY',
      insertText: 'ARRAY '
    },
    {
      label: 'AS',
      insertText: 'AS '
    },
    {
      label: 'ASC',
      insertText: 'ASC '
    },
    {
      label: 'ASENSITIVE',
      insertText: 'ASENSITIVE '
    },
    {
      label: 'ASSERTION',
      insertText: 'ASSERTION '
    },
    {
      label: 'ASSIGNMENT',
      insertText: 'ASSIGNMENT '
    },
    {
      label: 'ASYMMETRIC',
      insertText: 'ASYMMETRIC '
    },
    {
      label: 'AT',
      insertText: 'AT '
    },
    {
      label: 'ATOMIC',
      insertText: 'ATOMIC '
    },
    {
      label: 'AUTHORIZATION',
      insertText: 'AUTHORIZATION '
    },
    {
      label: 'AVG',
      insertText: 'AVG '
    },
    {
      label: 'BEFORE',
      insertText: 'BEFORE '
    },
    {
      label: 'BEGIN',
      insertText: 'BEGIN '
    },
    {
      label: 'BETWEEN',
      insertText: 'BETWEEN '
    },
    {
      label: 'BINARY',
      insertText: 'BINARY '
    },
    {
      label: 'BIT',
      insertText: 'BIT '
    },
    {
      label: 'BIT_LENGTH',
      insertText: 'BIT_LENGTH '
    },
    {
      label: 'BITVAR',
      insertText: 'BITVAR '
    },
    {
      label: 'BLOB',
      insertText: 'BLOB '
    },
    {
      label: 'BOOLEAN',
      insertText: 'BOOLEAN '
    },
    {
      label: 'BOTH',
      insertText: 'BOTH '
    },
    {
      label: 'BREADTH',
      insertText: 'BREADTH '
    },
    {
      label: 'BY',
      insertText: 'BY '
    },
    {
      label: 'C',
      insertText: 'C '
    },
    {
      label: 'CALL',
      insertText: 'CALL '
    },
    {
      label: 'CALLED',
      insertText: 'CALLED '
    },
    {
      label: 'CARDINALITY',
      insertText: 'CARDINALITY '
    },
    {
      label: 'CASCADE',
      insertText: 'CASCADE '
    },
    {
      label: 'CASCADED',
      insertText: 'CASCADED '
    },
    {
      label: 'CASE',
      insertText: 'CASE '
    },
    {
      label: 'CAST',
      insertText: 'CAST '
    },
    {
      label: 'CATALOG',
      insertText: 'CATALOG '
    },
    {
      label: 'CATALOG_NAME',
      insertText: 'CATALOG_NAME '
    },
    {
      label: 'CHAIN',
      insertText: 'CHAIN '
    },
    {
      label: 'CHAR',
      insertText: 'CHAR '
    },
    {
      label: 'CHAR_LENGTH',
      insertText: 'CHAR_LENGTH '
    },
    {
      label: 'CHARACTER',
      insertText: 'CHARACTER '
    },
    {
      label: 'CHARACTER_LENGTH',
      insertText: 'CHARACTER_LENGTH '
    },
    {
      label: 'CHARACTER_SET_CATALOG',
      insertText: 'CHARACTER_SET_CATALOG '
    },
    {
      label: 'CHARACTER_SET_NAME',
      insertText: 'CHARACTER_SET_NAME '
    },
    {
      label: 'CHARACTER_SET_SCHEMA',
      insertText: 'CHARACTER_SET_SCHEMA '
    },
    {
      label: 'CHECK',
      insertText: 'CHECK '
    },
    {
      label: 'CHECKED',
      insertText: 'CHECKED '
    },
    {
      label: 'CLASS',
      insertText: 'CLASS '
    },
    {
      label: 'CLASS_ORIGIN',
      insertText: 'CLASS_ORIGIN '
    },
    {
      label: 'CLOB',
      insertText: 'CLOB '
    },
    {
      label: 'CLOSE',
      insertText: 'CLOSE '
    },
    {
      label: 'COALESCE',
      insertText: 'COALESCE '
    },
    {
      label: 'COBOL',
      insertText: 'COBOL '
    },
    {
      label: 'COLLATE',
      insertText: 'COLLATE '
    },
    {
      label: 'COLLATION',
      insertText: 'COLLATION '
    },
    {
      label: 'COLLATION_CATALOG',
      insertText: 'COLLATION_CATALOG '
    },
    {
      label: 'COLLATION_NAME',
      insertText: 'COLLATION_NAME '
    },
    {
      label: 'COLLATION_SCHEMA',
      insertText: 'COLLATION_SCHEMA '
    },
    {
      label: 'COLUMN',
      insertText: 'COLUMN '
    },
    {
      label: 'cn',
      insertText: 'cn '
    },
    {
      label: 'COMMAND_FUNCTION',
      insertText: 'COMMAND_FUNCTION '
    },
    {
      label: 'COMMAND_FUNCTION_CODE',
      insertText: 'COMMAND_FUNCTION_CODE '
    },
    {
      label: 'COMMIT',
      insertText: 'COMMIT '
    },
    {
      label: 'COMMIT AND CHAIN',
      insertText: 'COMMIT AND CHAIN '
    },
    {
      label: 'COMMIT AND NO CHAIN',
      insertText: 'COMMIT AND NO CHAIN '
    },
    {
      label: 'COMMIT WORK',
      insertText: 'COMMIT WORK '
    },
    {
      label: 'COMMIT WORK AND CHAIN',
      insertText: 'COMMIT WORK AND CHAIN '
    },
    {
      label: 'COMMIT WORK AND NO CHAIN',
      insertText: 'COMMIT WORK AND NO CHAIN '
    },
    {
      label: 'COMMITTED',
      insertText: 'COMMITTED '
    },
    {
      label: 'COMPLETION',
      insertText: 'COMPLETION '
    },
    {
      label: 'CONDITION_NUMBER',
      insertText: 'CONDITION_NUMBER '
    },
    {
      label: 'CONNECT',
      insertText: 'CONNECT '
    },
    {
      label: 'CONNECT TO',
      insertText: 'CONNECT TO '
    },
    {
      label: 'CONNECT TO DEFAULT',
      insertText: 'CONNECT TO DEFAULT '
    },
    {
      label: 'CONNECTION',
      insertText: 'CONNECTION '
    },
    {
      label: 'CONNECTION_NAME',
      insertText: 'CONNECTION_NAME '
    },
    {
      label: 'CONSTRAINT',
      insertText: 'CONSTRAINT '
    },
    {
      label: 'CONSTRAINT_CATALOG',
      insertText: 'CONSTRAINT_CATALOG '
    },
    {
      label: 'CONSTRAINT_NAME',
      insertText: 'CONSTRAINT_NAME '
    },
    {
      label: 'CONSTRAINT_SCHEMA',
      insertText: 'CONSTRAINT_SCHEMA '
    },
    {
      label: 'CONSTRAINTS',
      insertText: 'CONSTRAINTS '
    },
    {
      label: 'CONSTRUCTOR',
      insertText: 'CONSTRUCTOR '
    },
    {
      label: 'CONTAINS',
      insertText: 'CONTAINS '
    },
    {
      label: 'CONTINUE',
      insertText: 'CONTINUE '
    },
    {
      label: 'CONVERT',
      insertText: 'CONVERT '
    },
    {
      label: 'CORRESPONDING',
      insertText: 'CORRESPONDING '
    },
    {
      label: 'COUNT',
      insertText: 'COUNT '
    },
    {
      label: 'CREATE',
      insertText: 'CREATE '
    },
    {
      label: 'CREATE ASSERTION',
      insertText: 'CREATE ASSERTION '
    },
    {
      label: 'CREATE CAST',
      insertText: 'CREATE CAST '
    },
    {
      label: 'CREATE CHARACTER SET',
      insertText: 'CREATE CHARACTER SET '
    },
    {
      label: 'CREATE COLLATION',
      insertText: 'CREATE COLLATION '
    },
    {
      label: 'CREATE DOMAIN',
      insertText: 'CREATE DOMAIN '
    },
    {
      label: 'CREATE FUNCTION',
      insertText: 'CREATE FUNCTION '
    },
    {
      label: 'CREATE METHOD',
      insertText: 'CREATE METHOD '
    },
    {
      label: 'CREATE ORDERING FOR',
      insertText: 'CREATE ORDERING FOR '
    },
    {
      label: 'CREATE RECURSIVE VIEW',
      insertText: 'CREATE RECURSIVE VIEW '
    },
    {
      label: 'CREATE ROLE',
      insertText: 'CREATE ROLE '
    },
    {
      label: 'CREATE ROUTINE',
      insertText: 'CREATE ROUTINE '
    },
    {
      label: 'CREATE SCHEMA',
      insertText: 'CREATE SCHEMA '
    },
    {
      label: 'CREATE TABLE',
      insertText: 'CREATE TABLE '
    },
    {
      label: 'CREATE TRANSFORM',
      insertText: 'CREATE TRANSFORM '
    },
    {
      label: 'CREATE TRANSLATION',
      insertText: 'CREATE TRANSLATION '
    },
    {
      label: 'CREATE TRIGGER',
      insertText: 'CREATE TRIGGER '
    },
    {
      label: 'CREATE TYPE',
      insertText: 'CREATE TYPE '
    },
    {
      label: 'CREATE VIEW',
      insertText: 'CREATE VIEW '
    },
    {
      label: 'CROSS',
      insertText: 'CROSS '
    },
    {
      label: 'CROSS JOIN',
      insertText: 'CROSS JOIN '
    },
    {
      label: 'CUBE',
      insertText: 'CUBE '
    },
    {
      label: 'CURRENT',
      insertText: 'CURRENT '
    },
    {
      label: 'CURRENT_DATE',
      insertText: 'CURRENT_DATE '
    },
    {
      label: 'CURRENT_PATH',
      insertText: 'CURRENT_PATH '
    },
    {
      label: 'CURRENT_ROLE',
      insertText: 'CURRENT_ROLE '
    },
    {
      label: 'CURRENT_TIME',
      insertText: 'CURRENT_TIME '
    },
    {
      label: 'CURRENT_TIMESTAMP',
      insertText: 'CURRENT_TIMESTAMP '
    },
    {
      label: 'CURRENT_USER',
      insertText: 'CURRENT_USER '
    },
    {
      label: 'CURSOR',
      insertText: 'CURSOR '
    },
    {
      label: 'CURSOR_NAME',
      insertText: 'CURSOR_NAME '
    },
    {
      label: 'CYCLE',
      insertText: 'CYCLE '
    },
    {
      label: 'DATA',
      insertText: 'DATA '
    },
    {
      label: 'DATE',
      insertText: 'DATE '
    },
    {
      label: 'DATETIME_INTERVAL_CODE',
      insertText: 'DATETIME_INTERVAL_CODE '
    },
    {
      label: 'DATETIME_INTERVAL_PRECISION',
      insertText: 'DATETIME_INTERVAL_PRECISION '
    },
    {
      label: 'DAY',
      insertText: 'DAY '
    },
    {
      label: 'DEALLOCATE',
      insertText: 'DEALLOCATE '
    },
    {
      label: 'DEC',
      insertText: 'DEC '
    },
    {
      label: 'DECIMAL',
      insertText: 'DECIMAL '
    },
    {
      label: 'DECLARE',
      insertText: 'DECLARE '
    },
    {
      label: 'DECLARE LOCAL TEMPORARY TABLE',
      insertText: 'DECLARE LOCAL TEMPORARY TABLE '
    },
    {
      label: 'DEFAULT',
      insertText: 'DEFAULT '
    },
    {
      label: 'DEFERRABLE',
      insertText: 'DEFERRABLE '
    },
    {
      label: 'DEFERRED',
      insertText: 'DEFERRED '
    },
    {
      label: 'DEFINED',
      insertText: 'DEFINED '
    },
    {
      label: 'DEFINER',
      insertText: 'DEFINER '
    },
    {
      label: 'DELETE',
      insertText: 'DELETE '
    },
    {
      label: 'DELETE FROM',
      insertText: 'DELETE FROM '
    },
    {
      label: 'DEPTH',
      insertText: 'DEPTH '
    },
    {
      label: 'DEREF',
      insertText: 'DEREF '
    },
    {
      label: 'DESC',
      insertText: 'DESC '
    },
    {
      label: 'DESCRIBE',
      insertText: 'DESCRIBE '
    },
    {
      label: 'DESCRIPTOR',
      insertText: 'DESCRIPTOR '
    },
    {
      label: 'DESTROY',
      insertText: 'DESTROY '
    },
    {
      label: 'DESTRUCTOR',
      insertText: 'DESTRUCTOR '
    },
    {
      label: 'DETERMINISTIC',
      insertText: 'DETERMINISTIC '
    },
    {
      label: 'DIAGNOSTICS',
      insertText: 'DIAGNOSTICS '
    },
    {
      label: 'DICTIONARY',
      insertText: 'DICTIONARY '
    },
    {
      label: 'DISCONNECT',
      insertText: 'DISCONNECT '
    },
    {
      label: 'DISCONNECT ALL',
      insertText: 'DISCONNECT ALL '
    },
    {
      label: 'DISCONNECT CURRENT',
      insertText: 'DISCONNECT CURRENT '
    },
    {
      label: 'DISPATCH',
      insertText: 'DISPATCH '
    },
    {
      label: 'DISTINCT',
      insertText: 'DISTINCT '
    },
    {
      label: 'DOMAIN',
      insertText: 'DOMAIN '
    },
    {
      label: 'DOUBLE',
      insertText: 'DOUBLE '
    },
    {
      label: 'DROP',
      insertText: 'DROP '
    },
    {
      label: 'DROP ASSERTION',
      insertText: 'DROP ASSERTION '
    },
    {
      label: 'DROP ATTRIBUTE',
      insertText: 'DROP ATTRIBUTE '
    },
    {
      label: 'DROP CAST',
      insertText: 'DROP CAST '
    },
    {
      label: 'DROP CHARACTER SET',
      insertText: 'DROP CHARACTER SET '
    },
    {
      label: 'DROP COLLATION',
      insertText: 'DROP COLLATION '
    },
    {
      label: 'DROP COLUMN',
      insertText: 'DROP COLUMN '
    },
    {
      label: 'DROP CONSTRAINT',
      insertText: 'DROP CONSTRAINT '
    },
    {
      label: 'DROP DEFAULT',
      insertText: 'DROP DEFAULT '
    },
    {
      label: 'DROP DOMAIN',
      insertText: 'DROP DOMAIN '
    },
    {
      label: 'DROP ORDERING FOR',
      insertText: 'DROP ORDERING FOR '
    },
    {
      label: 'DROP ROLE',
      insertText: 'DROP ROLE '
    },
    {
      label: 'DROP ROUTINE',
      insertText: 'DROP ROUTINE '
    },
    {
      label: 'DROP SCHEMA',
      insertText: 'DROP SCHEMA '
    },
    {
      label: 'DROP SCOPE',
      insertText: 'DROP SCOPE '
    },
    {
      label: 'DROP SPECIFIC ROUTINE',
      insertText: 'DROP SPECIFIC ROUTINE '
    },
    {
      label: 'DROP TABLE',
      insertText: 'DROP TABLE '
    },
    {
      label: 'DROP TRANSFORM',
      insertText: 'DROP TRANSFORM '
    },
    {
      label: 'DROP TRANSLATION',
      insertText: 'DROP TRANSLATION '
    },
    {
      label: 'DROP TRIGGER',
      insertText: 'DROP TRIGGER '
    },
    {
      label: 'DROP TYPE',
      insertText: 'DROP TYPE '
    },
    {
      label: 'DROP VIEW',
      insertText: 'DROP VIEW '
    },
    {
      label: 'DYNAMIC',
      insertText: 'DYNAMIC '
    },
    {
      label: 'DYNAMIC_FUNCTION',
      insertText: 'DYNAMIC_FUNCTION '
    },
    {
      label: 'DYNAMIC_FUNCTION_CODE',
      insertText: 'DYNAMIC_FUNCTION_CODE '
    },
    {
      label: 'EACH',
      insertText: 'EACH '
    },
    {
      label: 'ELSE',
      insertText: 'ELSE '
    },
    {
      label: 'END',
      insertText: 'END '
    },
    {
      label: 'END-EXEC',
      insertText: 'END-EXEC '
    },
    {
      label: 'EQUALS',
      insertText: 'EQUALS '
    },
    {
      label: 'ESCAPE',
      insertText: 'ESCAPE '
    },
    {
      label: 'EVERY',
      insertText: 'EVERY '
    },
    {
      label: 'EXCEPT',
      insertText: 'EXCEPT '
    },
    {
      label: 'EXCEPT ALL',
      insertText: 'EXCEPT ALL '
    },
    {
      label: 'EXCEPT DISTINCT',
      insertText: 'EXCEPT DISTINCT '
    },
    {
      label: 'EXCEPTION',
      insertText: 'EXCEPTION '
    },
    {
      label: 'EXEC',
      insertText: 'EXEC '
    },
    {
      label: 'EXECUTE',
      insertText: 'EXECUTE '
    },
    {
      label: 'EXISTING',
      insertText: 'EXISTING '
    },
    {
      label: 'EXISTS',
      insertText: 'EXISTS '
    },
    {
      label: 'EXTERNAL',
      insertText: 'EXTERNAL '
    },
    {
      label: 'EXTRACT',
      insertText: 'EXTRACT '
    },
    {
      label: 'FALSE',
      insertText: 'FALSE '
    },
    {
      label: 'FETCH',
      insertText: 'FETCH '
    },
    {
      label: 'FETCH ABSOLUTE FROM',
      insertText: 'FETCH ABSOLUTE FROM '
    },
    {
      label: 'FETCH FIRST FROM',
      insertText: 'FETCH FIRST FROM '
    },
    {
      label: 'FETCH LAST FROM',
      insertText: 'FETCH LAST FROM '
    },
    {
      label: 'FETCH NEXT FROM',
      insertText: 'FETCH NEXT FROM '
    },
    {
      label: 'FETCH PRIOR FROM',
      insertText: 'FETCH PRIOR FROM '
    },
    {
      label: 'FETCH RELATIVE FROM',
      insertText: 'FETCH RELATIVE FROM '
    },
    {
      label: 'FINAL',
      insertText: 'FINAL '
    },
    {
      label: 'FIRST',
      insertText: 'FIRST '
    },
    {
      label: 'FLOAT',
      insertText: 'FLOAT '
    },
    {
      label: 'FOR',
      insertText: 'FOR '
    },
    {
      label: 'FOREIGN',
      insertText: 'FOREIGN '
    },
    {
      label: 'FOREIGN KEY',
      insertText: 'FOREIGN KEY '
    },
    {
      label: 'FORTRAN',
      insertText: 'FORTRAN '
    },
    {
      label: 'FOUND',
      insertText: 'FOUND '
    },
    {
      label: 'FREE',
      insertText: 'FREE '
    },
    {
      label: 'FREE LOCATOR',
      insertText: 'FREE LOCATOR '
    },
    {
      label: 'FROM',
      insertText: 'FROM '
    },
    {
      label: 'FULL',
      insertText: 'FULL '
    },
    {
      label: 'FULL JOIN',
      insertText: 'FULL JOIN '
    },
    {
      label: 'FUNCTION',
      insertText: 'FUNCTION '
    },
    {
      label: 'GENERAL',
      insertText: 'GENERAL '
    },
    {
      label: 'GENERATED',
      insertText: 'GENERATED '
    },
    {
      label: 'GET',
      insertText: 'GET '
    },
    {
      label: 'GET DIAGNOSTICS',
      insertText: 'GET DIAGNOSTICS '
    },
    {
      label: 'GLOBAL',
      insertText: 'GLOBAL '
    },
    {
      label: 'GO',
      insertText: 'GO '
    },
    {
      label: 'GOTO',
      insertText: 'GOTO '
    },
    {
      label: 'GRANT',
      insertText: 'GRANT '
    },
    {
      label: 'GRANT EXECUTE ON',
      insertText: 'GRANT EXECUTE ON '
    },
    {
      label: 'GRANT OPTION ON',
      insertText: 'GRANT OPTION ON '
    },
    {
      label: 'GRANT REFERENCES',
      insertText: 'GRANT REFERENCES '
    },
    {
      label: 'GRANT REFERENCES ON',
      insertText: 'GRANT REFERENCES ON '
    },
    {
      label: 'GRANT SELECT ON',
      insertText: 'GRANT SELECT ON '
    },
    {
      label: 'GRANT UNDER ON',
      insertText: 'GRANT UNDER ON '
    },
    {
      label: 'GRANT USAGE ON',
      insertText: 'GRANT USAGE ON '
    },
    {
      label: 'GRANTED',
      insertText: 'GRANTED '
    },
    {
      label: 'GRANTED BY',
      insertText: 'GRANTED BY '
    },
    {
      label: 'GROUP',
      insertText: 'GROUP '
    },
    {
      label: 'GROUP BY',
      insertText: 'GROUP BY '
    },
    {
      label: 'GROUPING',
      insertText: 'GROUPING '
    },
    {
      label: 'HAVING',
      insertText: 'HAVING '
    },
    {
      label: 'HIERARCHY',
      insertText: 'HIERARCHY '
    },
    {
      label: 'HOLD',
      insertText: 'HOLD '
    },
    {
      label: 'HOLD LOCATOR',
      insertText: 'HOLD LOCATOR '
    },
    {
      label: 'HOST',
      insertText: 'HOST '
    },
    {
      label: 'HOUR',
      insertText: 'HOUR '
    },
    {
      label: 'IDENTITY',
      insertText: 'IDENTITY '
    },
    {
      label: 'IF',
      insertText: 'IF '
    },
    {
      label: 'IGNORE',
      insertText: 'IGNORE '
    },
    {
      label: 'IMMEDIATE',
      insertText: 'IMMEDIATE '
    },
    {
      label: 'IMPLEMENTATION',
      insertText: 'IMPLEMENTATION '
    },
    {
      label: 'IN',
      insertText: 'IN '
    },
    {
      label: 'INDICATOR',
      insertText: 'INDICATOR '
    },
    {
      label: 'INFIX',
      insertText: 'INFIX '
    },
    {
      label: 'INITIALIZE',
      insertText: 'INITIALIZE '
    },
    {
      label: 'INITIALLY',
      insertText: 'INITIALLY '
    },
    {
      label: 'INNER',
      insertText: 'INNER '
    },
    {
      label: 'INNER JOIN',
      insertText: 'INNER JOIN '
    },
    {
      label: 'INOUT',
      insertText: 'INOUT '
    },
    {
      label: 'INPUT',
      insertText: 'INPUT '
    },
    {
      label: 'INSENSITIVE',
      insertText: 'INSENSITIVE '
    },
    {
      label: 'INSERT',
      insertText: 'INSERT '
    },
    {
      label: 'INSERT INTO',
      insertText: 'INSERT INTO '
    },
    {
      label: 'INSTANCE',
      insertText: 'INSTANCE '
    },
    {
      label: 'INSTANTIABLE',
      insertText: 'INSTANTIABLE '
    },
    {
      label: 'INT',
      insertText: 'INT '
    },
    {
      label: 'INTEGER',
      insertText: 'INTEGER '
    },
    {
      label: 'INTERSECT',
      insertText: 'INTERSECT '
    },
    {
      label: 'INTERSECT ALL',
      insertText: 'INTERSECT ALL '
    },
    {
      label: 'INTERSECT DISTINCT',
      insertText: 'INTERSECT DISTINCT '
    },
    {
      label: 'INTERVAL',
      insertText: 'INTERVAL '
    },
    {
      label: 'INTO',
      insertText: 'INTO '
    },
    {
      label: 'INVOKER',
      insertText: 'INVOKER '
    },
    {
      label: 'IS',
      insertText: 'IS '
    },
    {
      label: 'IS DISTINCT FROM',
      insertText: 'IS DISTINCT FROM '
    },
    {
      label: 'IS NOT',
      insertText: 'IS NOT '
    },
    {
      label: 'IS NOT NULL',
      insertText: 'IS NOT NULL '
    },
    {
      label: 'IS NULL',
      insertText: 'IS NULL '
    },
    {
      label: 'IS OF',
      insertText: 'IS OF '
    },
    {
      label: 'ISOLATION',
      insertText: 'ISOLATION '
    },
    {
      label: 'ITERATE',
      insertText: 'ITERATE '
    },
    {
      label: 'JOIN',
      insertText: 'JOIN '
    },
    {
      label: 'KEY',
      insertText: 'KEY '
    },
    {
      label: 'KEY_MEMBER',
      insertText: 'KEY_MEMBER '
    },
    {
      label: 'KEY_TYPE',
      insertText: 'KEY_TYPE '
    },
    {
      label: 'LANGUAGE',
      insertText: 'LANGUAGE '
    },
    {
      label: 'LARGE',
      insertText: 'LARGE '
    },
    {
      label: 'LAST',
      insertText: 'LAST '
    },
    {
      label: 'LATERAL',
      insertText: 'LATERAL '
    },
    {
      label: 'LEADING',
      insertText: 'LEADING '
    },
    {
      label: 'LEFT',
      insertText: 'LEFT '
    },
    {
      label: 'LEFT JOIN',
      insertText: 'LEFT JOIN '
    },
    {
      label: 'LENGTH',
      insertText: 'LENGTH '
    },
    {
      label: 'LESS',
      insertText: 'LESS '
    },
    {
      label: 'LEVEL',
      insertText: 'LEVEL '
    },
    {
      label: 'LIKE',
      insertText: 'LIKE '
    },
    {
      label: 'LIMIT',
      insertText: 'LIMIT '
    },
    {
      label: 'LOCAL',
      insertText: 'LOCAL '
    },
    {
      label: 'LOCALTIME',
      insertText: 'LOCALTIME '
    },
    {
      label: 'LOCALTIMESTAMP',
      insertText: 'LOCALTIMESTAMP '
    },
    {
      label: 'LOCATOR',
      insertText: 'LOCATOR '
    },
    {
      label: 'LOWER',
      insertText: 'LOWER '
    },
    {
      label: 'MAP',
      insertText: 'MAP '
    },
    {
      label: 'MATCH',
      insertText: 'MATCH '
    },
    {
      label: 'MAX',
      insertText: 'MAX '
    },
    {
      label: 'MESSAGE_LENGTH',
      insertText: 'MESSAGE_LENGTH '
    },
    {
      label: 'MESSAGE_OCTET_LENGTH',
      insertText: 'MESSAGE_OCTET_LENGTH '
    },
    {
      label: 'MESSAGE_TEXT',
      insertText: 'MESSAGE_TEXT '
    },
    {
      label: 'METHOD',
      insertText: 'METHOD '
    },
    {
      label: 'MIN',
      insertText: 'MIN '
    },
    {
      label: 'MINUTE',
      insertText: 'MINUTE '
    },
    {
      label: 'MOD',
      insertText: 'MOD '
    },
    {
      label: 'MODIFIES',
      insertText: 'MODIFIES '
    },
    {
      label: 'MODIFY',
      insertText: 'MODIFY '
    },
    {
      label: 'MODULE',
      insertText: 'MODULE '
    },
    {
      label: 'MONTH',
      insertText: 'MONTH '
    },
    {
      label: 'MORE',
      insertText: 'MORE '
    },
    {
      label: 'MUMPS',
      insertText: 'MUMPS '
    },
    {
      label: 'NAME',
      insertText: 'NAME '
    },
    {
      label: 'NAMES',
      insertText: 'NAMES '
    },
    {
      label: 'NATIONAL',
      insertText: 'NATIONAL '
    },
    {
      label: 'NATURAL',
      insertText: 'NATURAL '
    },
    {
      label: 'NCHAR',
      insertText: 'NCHAR '
    },
    {
      label: 'NCLOB',
      insertText: 'NCLOB '
    },
    {
      label: 'NEW',
      insertText: 'NEW '
    },
    {
      label: 'NEXT',
      insertText: 'NEXT '
    },
    {
      label: 'NO',
      insertText: 'NO '
    },
    {
      label: 'NONE',
      insertText: 'NONE '
    },
    {
      label: 'NOT',
      insertText: 'NOT '
    },
    {
      label: 'NOT BETWEEN',
      insertText: 'NOT BETWEEN '
    },
    {
      label: 'NOT CHECKED',
      insertText: 'NOT CHECKED '
    },
    {
      label: 'NOT DEFERRABLE',
      insertText: 'NOT DEFERRABLE '
    },
    {
      label: 'NOT DETERMINISTIC',
      insertText: 'NOT DETERMINISTIC '
    },
    {
      label: 'NOT EXISTS',
      insertText: 'NOT EXISTS '
    },
    {
      label: 'NOT FINAL',
      insertText: 'NOT FINAL '
    },
    {
      label: 'NOT IN',
      insertText: 'NOT IN '
    },
    {
      label: 'NOT LIKE',
      insertText: 'NOT LIKE '
    },
    {
      label: 'NOT NULL',
      insertText: 'NOT NULL '
    },
    {
      label: 'NOT OF',
      insertText: 'NOT OF '
    },
    {
      label: 'NOT SIMILAR',
      insertText: 'NOT SIMILAR '
    },
    {
      label: 'NULL',
      insertText: 'NULL '
    },
    {
      label: 'NULLABLE',
      insertText: 'NULLABLE '
    },
    {
      label: 'NULLIF',
      insertText: 'NULLIF '
    },
    {
      label: 'NUMBER',
      insertText: 'NUMBER '
    },
    {
      label: 'NUMERIC',
      insertText: 'NUMERIC '
    },
    {
      label: 'OBJECT',
      insertText: 'OBJECT '
    },
    {
      label: 'OCTET_LENGTH',
      insertText: 'OCTET_LENGTH '
    },
    {
      label: 'OF',
      insertText: 'OF '
    },
    {
      label: 'OFF',
      insertText: 'OFF '
    },
    {
      label: 'OLD',
      insertText: 'OLD '
    },
    {
      label: 'ON',
      insertText: 'ON '
    },
    {
      label: 'ONLY',
      insertText: 'ONLY '
    },
    {
      label: 'OPEN',
      insertText: 'OPEN '
    },
    {
      label: 'OPERATION',
      insertText: 'OPERATION '
    },
    {
      label: 'OPTION',
      insertText: 'OPTION '
    },
    {
      label: 'OPTIONS',
      insertText: 'OPTIONS '
    },
    {
      label: 'OR',
      insertText: 'OR '
    },
    {
      label: 'ORDER',
      insertText: 'ORDER '
    },
    {
      label: 'ORDINALITY',
      insertText: 'ORDINALITY '
    },
    {
      label: 'OUT',
      insertText: 'OUT '
    },
    {
      label: 'OUTER',
      insertText: 'OUTER '
    },
    {
      label: 'OUTPUT',
      insertText: 'OUTPUT '
    },
    {
      label: 'OVERLAPS',
      insertText: 'OVERLAPS '
    },
    {
      label: 'OVERLAY',
      insertText: 'OVERLAY '
    },
    {
      label: 'OVERRIDING',
      insertText: 'OVERRIDING '
    },
    {
      label: 'PAD',
      insertText: 'PAD '
    },
    {
      label: 'PARAMETER',
      insertText: 'PARAMETER '
    },
    {
      label: 'PARAMETER_MODE',
      insertText: 'PARAMETER_MODE '
    },
    {
      label: 'PARAMETER_NAME',
      insertText: 'PARAMETER_NAME '
    },
    {
      label: 'PARAMETER_ORDINAL_POSITION',
      insertText: 'PARAMETER_ORDINAL_POSITION '
    },
    {
      label: 'PARAMETER_SPECIFIC_CATALOG',
      insertText: 'PARAMETER_SPECIFIC_CATALOG '
    },
    {
      label: 'PARAMETER_SPECIFIC_NAME',
      insertText: 'PARAMETER_SPECIFIC_NAME '
    },
    {
      label: 'PARAMETER_SPECIFIC_SCHEMA',
      insertText: 'PARAMETER_SPECIFIC_SCHEMA '
    },
    {
      label: 'PARAMETERS',
      insertText: 'PARAMETERS '
    },
    {
      label: 'PARTIAL',
      insertText: 'PARTIAL '
    },
    {
      label: 'PASCAL',
      insertText: 'PASCAL '
    },
    {
      label: 'PATH',
      insertText: 'PATH '
    },
    {
      label: 'PLI',
      insertText: 'PLI '
    },
    {
      label: 'POSITION',
      insertText: 'POSITION '
    },
    {
      label: 'POSTFIX',
      insertText: 'POSTFIX '
    },
    {
      label: 'PRECISION',
      insertText: 'PRECISION '
    },
    {
      label: 'PREFIX',
      insertText: 'PREFIX '
    },
    {
      label: 'PREORDER',
      insertText: 'PREORDER '
    },
    {
      label: 'PREPARE',
      insertText: 'PREPARE '
    },
    {
      label: 'PRESERVE',
      insertText: 'PRESERVE '
    },
    {
      label: 'PRIMARY',
      insertText: 'PRIMARY '
    },
    {
      label: 'PRIMARY KEY',
      insertText: 'PRIMARY KEY '
    },
    {
      label: 'PRIOR',
      insertText: 'PRIOR '
    },
    {
      label: 'PRIVILEGES',
      insertText: 'PRIVILEGES '
    },
    {
      label: 'PROCEDURE',
      insertText: 'PROCEDURE '
    },
    {
      label: 'PUBLIC',
      insertText: 'PUBLIC '
    },
    {
      label: 'READ',
      insertText: 'READ '
    },
    {
      label: 'READS',
      insertText: 'READS '
    },
    {
      label: 'REAL',
      insertText: 'REAL '
    },
    {
      label: 'RECURSIVE',
      insertText: 'RECURSIVE '
    },
    {
      label: 'REF',
      insertText: 'REF '
    },
    {
      label: 'REFERENCES',
      insertText: 'REFERENCES '
    },
    {
      label: 'REFERENCING',
      insertText: 'REFERENCING '
    },
    {
      label: 'RELATIVE',
      insertText: 'RELATIVE '
    },
    {
      label: 'RELEASE SAVEPOINT',
      insertText: 'RELEASE SAVEPOINT '
    },
    {
      label: 'REPEATABLE',
      insertText: 'REPEATABLE '
    },
    {
      label: 'RESTRICT',
      insertText: 'RESTRICT '
    },
    {
      label: 'RESULT',
      insertText: 'RESULT '
    },
    {
      label: 'RETURN',
      insertText: 'RETURN '
    },
    {
      label: 'RETURN NULL',
      insertText: 'RETURN NULL '
    },
    {
      label: 'RETURNED_LENGTH',
      insertText: 'RETURNED_LENGTH '
    },
    {
      label: 'RETURNED_OCTET_LENGTH',
      insertText: 'RETURNED_OCTET_LENGTH '
    },
    {
      label: 'RETURNED_SQLSTATE',
      insertText: 'RETURNED_SQLSTATE '
    },
    {
      label: 'RETURNS',
      insertText: 'RETURNS '
    },
    {
      label: 'REVOKE',
      insertText: 'REVOKE '
    },
    {
      label: 'REVOKE ALL PRIVILEGES ON',
      insertText: 'REVOKE ALL PRIVILEGES ON '
    },
    {
      label: 'REVOKE EXECUTE ON',
      insertText: 'REVOKE EXECUTE ON '
    },
    {
      label: 'REVOKE INSERT',
      insertText: 'REVOKE INSERT '
    },
    {
      label: 'REVOKE USAGE ON',
      insertText: 'REVOKE USAGE ON '
    },
    {
      label: 'RIGHT',
      insertText: 'RIGHT '
    },
    {
      label: 'RIGHT JOIN',
      insertText: 'RIGHT JOIN '
    },
    {
      label: 'ROLE',
      insertText: 'ROLE '
    },
    {
      label: 'ROLLBACK',
      insertText: 'ROLLBACK '
    },
    {
      label: 'ROLLBACK AND CHAIN',
      insertText: 'ROLLBACK AND CHAIN '
    },
    {
      label: 'ROLLBACK AND NO CHAIN',
      insertText: 'ROLLBACK AND NO CHAIN '
    },
    {
      label: 'ROLLBACK WORK',
      insertText: 'ROLLBACK WORK '
    },
    {
      label: 'ROLLBACK WORK AND CHAIN',
      insertText: 'ROLLBACK WORK AND CHAIN '
    },
    {
      label: 'ROLLBACK WORK AND NO CHAIN',
      insertText: 'ROLLBACK WORK AND NO CHAIN '
    },
    {
      label: 'ROLLUP',
      insertText: 'ROLLUP '
    },
    {
      label: 'ROUTINE',
      insertText: 'ROUTINE '
    },
    {
      label: 'ROUTINE_CATALOG',
      insertText: 'ROUTINE_CATALOG '
    },
    {
      label: 'ROUTINE_NAME',
      insertText: 'ROUTINE_NAME '
    },
    {
      label: 'ROUTINE_SCHEMA',
      insertText: 'ROUTINE_SCHEMA '
    },
    {
      label: 'ROW',
      insertText: 'ROW '
    },
    {
      label: 'ROW_COUNT',
      insertText: 'ROW_COUNT '
    },
    {
      label: 'ROWS',
      insertText: 'ROWS '
    },
    {
      label: 'SAVEPOINT',
      insertText: 'SAVEPOINT '
    },
    {
      label: 'SCALE',
      insertText: 'SCALE '
    },
    {
      label: 'SCHEMA',
      insertText: 'SCHEMA '
    },
    {
      label: 'SCHEMA_NAME',
      insertText: 'SCHEMA_NAME '
    },
    {
      label: 'SCOPE',
      insertText: 'SCOPE '
    },
    {
      label: 'SCROLL',
      insertText: 'SCROLL '
    },
    {
      label: 'SEARCH',
      insertText: 'SEARCH '
    },
    {
      label: 'SECOND',
      insertText: 'SECOND '
    },
    {
      label: 'SECTION',
      insertText: 'SECTION '
    },
    {
      label: 'SECURITY',
      insertText: 'SECURITY '
    },
    {
      label: 'SELECT',
      insertText: 'SELECT '
    },
    {
      label: 'SELECT *',
      insertText: 'SELECT * '
    },
    {
      label: 'SELECT * FROM',
      insertText: 'SELECT * FROM '
    },
    {
      label: 'SELECT ALL',
      insertText: 'SELECT ALL '
    },
    {
      label: 'SELECT DISTINCT',
      insertText: 'SELECT DISTINCT '
    },
    {
      label: 'SELF',
      insertText: 'SELF '
    },
    {
      label: 'SENSITIVE',
      insertText: 'SENSITIVE '
    },
    {
      label: 'SEQUENCE',
      insertText: 'SEQUENCE '
    },
    {
      label: 'SERIALIZABLE',
      insertText: 'SERIALIZABLE '
    },
    {
      label: 'SERVER_NAME',
      insertText: 'SERVER_NAME '
    },
    {
      label: 'SESSION',
      insertText: 'SESSION '
    },
    {
      label: 'SESSION_USER',
      insertText: 'SESSION_USER '
    },
    {
      label: 'SET',
      insertText: 'SET '
    },
    {
      label: 'SET CONNECTION',
      insertText: 'SET CONNECTION '
    },
    {
      label: 'SET CONNECTION DEFAULT',
      insertText: 'SET CONNECTION DEFAULT '
    },
    {
      label: 'SET CONSTRAINTS',
      insertText: 'SET CONSTRAINTS '
    },
    {
      label: 'SET DEFAULT',
      insertText: 'SET DEFAULT '
    },
    {
      label: 'SET LOCAL TRANSACTION',
      insertText: 'SET LOCAL TRANSACTION '
    },
    {
      label: 'SET NULL',
      insertText: 'SET NULL '
    },
    {
      label: 'SET ROLE',
      insertText: 'SET ROLE '
    },
    {
      label: 'SET ROW',
      insertText: 'SET ROW '
    },
    {
      label: 'SET SESSION AUTHORIZATION',
      insertText: 'SET SESSION AUTHORIZATION '
    },
    {
      label: 'SET SESSION CHARACTERISTICS AS',
      insertText: 'SET SESSION CHARACTERISTICS AS '
    },
    {
      label: 'SET TIME ZONE',
      insertText: 'SET TIME ZONE '
    },
    {
      label: 'SET TIME ZONE LOCAL',
      insertText: 'SET TIME ZONE LOCAL '
    },
    {
      label: 'SET TRANSACTION',
      insertText: 'SET TRANSACTION '
    },
    {
      label: 'SETS',
      insertText: 'SETS '
    },
    {
      label: 'SIMILAR',
      insertText: 'SIMILAR '
    },
    {
      label: 'SIMPLE',
      insertText: 'SIMPLE '
    },
    {
      label: 'SIZE',
      insertText: 'SIZE '
    },
    {
      label: 'SMALLINT',
      insertText: 'SMALLINT '
    },
    {
      label: 'SOME',
      insertText: 'SOME '
    },
    {
      label: 'SOURCE',
      insertText: 'SOURCE '
    },
    {
      label: 'SPACE',
      insertText: 'SPACE '
    },
    {
      label: 'SPECIFIC',
      insertText: 'SPECIFIC '
    },
    {
      label: 'SPECIFIC_NAME',
      insertText: 'SPECIFIC_NAME '
    },
    {
      label: 'SPECIFICTYPE',
      insertText: 'SPECIFICTYPE '
    },
    {
      label: 'SQL',
      insertText: 'SQL '
    },
    {
      label: 'SQLEXCEPTION',
      insertText: 'SQLEXCEPTION '
    },
    {
      label: 'SQLSTATE',
      insertText: 'SQLSTATE '
    },
    {
      label: 'SQLWARNING',
      insertText: 'SQLWARNING '
    },
    {
      label: 'START',
      insertText: 'START '
    },
    {
      label: 'START TRANSACTION',
      insertText: 'START TRANSACTION '
    },
    {
      label: 'STATE',
      insertText: 'STATE '
    },
    {
      label: 'STATEMENT',
      insertText: 'STATEMENT '
    },
    {
      label: 'STATIC',
      insertText: 'STATIC '
    },
    {
      label: 'STRUCTURE',
      insertText: 'STRUCTURE '
    },
    {
      label: 'STYLE',
      insertText: 'STYLE '
    },
    {
      label: 'SUBCLASS_ORIGIN',
      insertText: 'SUBCLASS_ORIGIN '
    },
    {
      label: 'SUBLIST',
      insertText: 'SUBLIST '
    },
    {
      label: 'SUBSTRING',
      insertText: 'SUBSTRING '
    },
    {
      label: 'SUM',
      insertText: 'SUM '
    },
    {
      label: 'SYMMETRIC',
      insertText: 'SYMMETRIC '
    },
    {
      label: 'SYSTEM',
      insertText: 'SYSTEM '
    },
    {
      label: 'SYSTEM_USER',
      insertText: 'SYSTEM_USER '
    },
    {
      label: 'TABLE',
      insertText: 'TABLE '
    },
    {
      label: 'TABLE_NAME',
      insertText: 'TABLE_NAME '
    },
    {
      label: 'TEMPORARY',
      insertText: 'TEMPORARY '
    },
    {
      label: 'TERMINATE',
      insertText: 'TERMINATE '
    },
    {
      label: 'THAN',
      insertText: 'THAN '
    },
    {
      label: 'THEN',
      insertText: 'THEN '
    },
    {
      label: 'TIME',
      insertText: 'TIME '
    },
    {
      label: 'TIMESTAMP',
      insertText: 'TIMESTAMP '
    },
    {
      label: 'TIMEZONE_HOUR',
      insertText: 'TIMEZONE_HOUR '
    },
    {
      label: 'TIMEZONE_MINUTE',
      insertText: 'TIMEZONE_MINUTE '
    },
    {
      label: 'TO',
      insertText: 'TO '
    },
    {
      label: 'TRAILING',
      insertText: 'TRAILING '
    },
    {
      label: 'TRANSACTION',
      insertText: 'TRANSACTION '
    },
    {
      label: 'TRANSACTION_ACTIVE',
      insertText: 'TRANSACTION_ACTIVE '
    },
    {
      label: 'TRANSACTIONS_COMMITTED',
      insertText: 'TRANSACTIONS_COMMITTED '
    },
    {
      label: 'TRANSACTIONS_ROLLED_BACK',
      insertText: 'TRANSACTIONS_ROLLED_BACK '
    },
    {
      label: 'TRANSFORM',
      insertText: 'TRANSFORM '
    },
    {
      label: 'TRANSFORMS',
      insertText: 'TRANSFORMS '
    },
    {
      label: 'TRANSLATE',
      insertText: 'TRANSLATE '
    },
    {
      label: 'TRANSLATION',
      insertText: 'TRANSLATION '
    },
    {
      label: 'TREAT',
      insertText: 'TREAT '
    },
    {
      label: 'TRIGGER',
      insertText: 'TRIGGER '
    },
    {
      label: 'TRIGGER_CATALOG',
      insertText: 'TRIGGER_CATALOG '
    },
    {
      label: 'TRIGGER_NAME',
      insertText: 'TRIGGER_NAME '
    },
    {
      label: 'TRIGGER_SCHEMA',
      insertText: 'TRIGGER_SCHEMA '
    },
    {
      label: 'TRIM',
      insertText: 'TRIM '
    },
    {
      label: 'TRUE',
      insertText: 'TRUE '
    },
    {
      label: 'TYPE',
      insertText: 'TYPE '
    },
    {
      label: 'UNCOMMITTED',
      insertText: 'UNCOMMITTED '
    },
    {
      label: 'UNDER',
      insertText: 'UNDER '
    },
    {
      label: 'UNION',
      insertText: 'UNION '
    },
    {
      label: 'UNION ALL',
      insertText: 'UNION ALL '
    },
    {
      label: 'UNION DISTINCT',
      insertText: 'UNION DISTINCT '
    },
    {
      label: 'UNION JOIN',
      insertText: 'UNION JOIN '
    },
    {
      label: 'UNIQUE',
      insertText: 'UNIQUE '
    },
    {
      label: 'UNKNOWN',
      insertText: 'UNKNOWN '
    },
    {
      label: 'UNNAMED',
      insertText: 'UNNAMED '
    },
    {
      label: 'UNNEST',
      insertText: 'UNNEST '
    },
    {
      label: 'UPDATE',
      insertText: 'UPDATE '
    },
    {
      label: 'UPPER',
      insertText: 'UPPER '
    },
    {
      label: 'USAGE',
      insertText: 'USAGE '
    },
    {
      label: 'USER',
      insertText: 'USER '
    },
    {
      label: 'USER_DEFINED_TYPE_CATALOG',
      insertText: 'USER_DEFINED_TYPE_CATALOG '
    },
    {
      label: 'USER_DEFINED_TYPE_NAME',
      insertText: 'USER_DEFINED_TYPE_NAME '
    },
    {
      label: 'USER_DEFINED_TYPE_SCHEMA',
      insertText: 'USER_DEFINED_TYPE_SCHEMA '
    },
    {
      label: 'USING',
      insertText: 'USING '
    },
    {
      label: 'VALUE',
      insertText: 'VALUE '
    },
    {
      label: 'VALUES',
      insertText: 'VALUES '
    },
    {
      label: 'VARCHAR',
      insertText: 'VARCHAR '
    },
    {
      label: 'VARIABLE',
      insertText: 'VARIABLE '
    },
    {
      label: 'VARYING',
      insertText: 'VARYING '
    },
    {
      label: 'VIEW',
      insertText: 'VIEW '
    },
    {
      label: 'WHEN',
      insertText: 'WHEN '
    },
    {
      label: 'WHENEVER',
      insertText: 'WHENEVER '
    },
    {
      label: 'WHERE',
      insertText: 'WHERE '
    },
    {
      label: 'WHERE EXISTS',
      insertText: 'WHERE EXISTS '
    },
    {
      label: 'WITH',
      insertText: 'WITH '
    },
    {
      label: 'WITHOUT',
      insertText: 'WITHOUT '
    },
    {
      label: 'WORK',
      insertText: 'WORK '
    },
    {
      label: 'WRITE',
      insertText: 'WRITE '
    },
    {
      label: 'YEAR',
      insertText: 'YEAR '
    },
    {
      label: 'ZONE',
      insertText: 'ZONE '
    }
  ]
}
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
