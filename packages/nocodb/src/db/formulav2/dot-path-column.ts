// Ids of the in-memory lookups a formula field path compiles to
export const DOT_PATH_COLUMN_PREFIX = '__nc_dot_';

export const isDotPathColumn = (column: { id?: string }) =>
  !!column?.id?.startsWith(DOT_PATH_COLUMN_PREFIX);
