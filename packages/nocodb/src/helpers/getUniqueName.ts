import type Column from '~/models/Column';

export function getUniqueColumnName(columns: Column[], initialName = 'field') {
  let c = 0;

  while (
    columns.some((col) => col.column_name === `${initialName}${c || ''}`)
  ) {
    c++;
  }

  return `${initialName}${c || ''}`;
}

export function getUniqueColumnAliasName(
  columns: Column[],
  initialName = 'field',
) {
  let c = 0;

  while (columns.some((col) => col.title === `${initialName}${c || ''}`)) {
    c++;
  }

  return `${initialName}${c || ''}`;
}
