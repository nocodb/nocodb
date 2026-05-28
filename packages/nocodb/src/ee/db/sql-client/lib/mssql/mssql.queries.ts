// T-SQL system-catalog introspection queries for Microsoft SQL Server.
//
// Shape mirrors pg.queries.ts: each operation key maps to
//   { default: { sql: string, paramsHints?: string[] } }
// (with optional version-specific variants keyed by SQL Server version).
//
// Populated in Phase 1 (schema introspection) — columnList, tableList,
// indexList, relationList, constraintList, viewList, etc. against
// sys.tables / sys.columns / sys.foreign_keys / sys.indexes and
// INFORMATION_SCHEMA. See `/Users/anbarasu/WebstormProjects/sql-docs/docs`
// for the exact catalog column names.

const mssqlQueries: Record<string, any> = {};

export default mssqlQueries;
