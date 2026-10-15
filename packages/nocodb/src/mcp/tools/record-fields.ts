import {
  isLinksOrLTAR,
  isReadOnlyColumn,
  isSelfLinkCol,
  isVirtualCol,
  parseProp,
  UITypes,
  validateEmail,
} from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type { Column } from '~/models';
import { Model } from '~/models';
import { NcError } from '~/helpers/catchError';
import { matchFieldRef } from '~/mcp/tools/filter-compile';
import {
  dateTimeFromFormat,
  dateTimeInputProblem,
} from '~/db/field-handler/handlers/date-time/date-time.general.handler';

const DEFAULT_RATING_MAX = 5;

// System links (the hidden has-many side of a many-to-one, the `_nc_m2m_*`
// junction) are not fields an agent can write, so they stay out of hints.
// A self-link counterpart is still written through its link.
export function isUserVisibleField(column: Column) {
  return !(isLinksOrLTAR(column) && column.system && !isSelfLinkCol(column));
}

function isWritable(column: Column) {
  if (isLinksOrLTAR(column)) return isUserVisibleField(column);
  return !column.system && !isReadOnlyColumn(column) && !isVirtualCol(column);
}

function assertValidValue(context: NcContext, column: Column, value: unknown) {
  if (value === null || value === undefined || value === '') return;

  if (column.uidt === UITypes.DateTime || column.uidt === UITypes.Date) {
    const problem = dateTimeInputProblem(value);
    if (problem) {
      NcError.get(context).badRequest(
        `"${value}" is not a valid date for field "${column.title}": ${problem}.`,
      );
    }
  }

  // Same opt-in as the data layer, so MCP accepts what REST and the UI accept.
  if (
    column.uidt === UITypes.Email &&
    parseProp(column.meta)?.validate &&
    !validateEmail(String(value))
  ) {
    NcError.get(context).badRequest(
      `"${value}" is not a valid email address for field "${column.title}".`,
    );
  }

  if (column.uidt === UITypes.Rating) {
    const max = Number(parseProp(column.meta)?.max) || DEFAULT_RATING_MAX;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > max) {
      NcError.get(context).badRequest(
        `Field "${column.title}" is a Rating and takes a whole number from 0 to ${max}.`,
      );
    }
  }
}

/**
 * The data layer silently skips unknown and computed fields. Refuse unknown
 * ones, drop read-only ones with a warning (so a record read from queryRecords
 * can still be written back as-is), and check the values the data layer lets
 * through.
 */
export async function checkRecordFields(
  context: NcContext,
  tableId: string,
  records: { fields?: Record<string, unknown> }[],
): Promise<{ warnings: string[]; ignored_fields: string[] }> {
  const model = await Model.get(context, tableId);
  if (!model) NcError.get(context).tableNotFound(tableId);

  const columns = await model.getColumns();

  const unknown = new Set<string>();
  const readOnly = new Set<string>();

  for (const [index, record] of records.entries()) {
    if (!record?.fields) continue;

    for (const [key, value] of Object.entries(record.fields)) {
      const matches = matchFieldRef(columns, key);
      if (!matches.length) {
        unknown.add(key);
        continue;
      }
      if (matches.length > 1) {
        const ids = matches.map((c) => c.id).join(', ');
        NcError.get(context).badRequest(
          `"${key}" matches ${matches.length} fields (${ids}). Pass the field id instead.`,
        );
      }
      const column = matches[0];
      if (!isWritable(column)) {
        readOnly.add(column.title);
        delete record.fields[key];
        continue;
      }
      try {
        assertValidValue(context, column, value);
      } catch (e) {
        // Batch errors name the entry, so the agent need not bisect.
        if (records.length > 1 && e instanceof Error) {
          e.message = `Record ${index}: ${e.message}`;
        }
        throw e;
      }
      let written = value;
      // The write path reads DateTime without the field's format, so a value
      // in that format is converted here ("10/03/2026" under DD/MM/YYYY).
      if (column.uidt === UITypes.DateTime) {
        const iso = dateTimeFromFormat(value, column.meta?.date_format);
        if (iso) written = iso;
      }
      // Key by id: a title can also be another field's column name, and the
      // data layer would then write both.
      if (key !== column.id) delete record.fields[key];
      record.fields[column.id] = written;
    }
  }

  if (unknown.size) {
    NcError.get(context).badRequest(
      `No field matches ${[...unknown]
        .map((k) => `"${k}"`)
        .join(', ')} in table "${model.title}". Writable fields: ${columns
        .filter(isWritable)
        .map((c) => c.title)
        .join(', ')}`,
    );
  }

  return {
    warnings: readOnly.size
      ? [
          `Read-only fields were not written: ${[...readOnly].join(', ')}. ` +
            'Their values are computed by NocoDB.',
        ]
      : [],
    ignored_fields: [...readOnly],
  };
}

/**
 * Titles for a write tool's `returnFields`, resolved before the write so a bad
 * name never fails a call whose rows are already committed.
 */
export async function resolveReturnFields(
  context: NcContext,
  tableId: string,
  refs: string[] | undefined,
): Promise<string[] | undefined> {
  if (!refs?.length) return undefined;

  const model = await Model.get(context, tableId);
  if (!model) NcError.get(context).tableNotFound(tableId);
  const columns = await model.getColumns();

  return refs.map((ref) => {
    const matches = matchFieldRef(columns, ref);
    if (matches.length === 1) return matches[0].title;
    NcError.get(context).badRequest(
      matches.length
        ? `"${ref}" matches ${matches.length} fields (${matches
            .map((c) => c.id)
            .join(', ')}). Pass the field id instead.`
        : `Unknown field "${ref}" in returnFields. Use a field title or ID from getTableSchema.`,
    );
  });
}

/** Keep only `titles` in each returned record; ids and warnings are untouched. */
export function pickReturnFields<
  T extends { records?: { fields?: Record<string, unknown> }[] },
>(result: T, titles: string[] | undefined): T {
  if (!titles || !Array.isArray(result?.records)) return result;

  return {
    ...result,
    records: result.records.map((record) => ({
      ...record,
      fields: Object.fromEntries(
        titles
          .filter((t) => record.fields && t in record.fields)
          .map((t) => [t, record.fields[t]]),
      ),
    })),
  };
}
