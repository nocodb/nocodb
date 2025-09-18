import { ColumnType } from '../Api';
import { stringAllMatches } from '../stringHelpers';

export interface SerializedAiTableType {
  tables?: {
    title?: string;
    description?: string | null;
    columns?: {
      title?: string;
      type?: string;
      options?: string[];
    }[];
  }[];
  relationships?: {
    from?: string;
    to?: string;
    type?: string;
  }[];
}

export interface SerializedAiViewType {
  type: string;
  table: string;
  title: string;
  description?: string | null;
  filters?: {
    comparison_op: string;
    logical_op: string;
    value?: number | null;
    column: string;
  }[];
  sorts?: {
    column: string;
    order: 'asc' | 'desc';
  }[];
  calendar_range?:
    | {
        from_column?: string;
      }
    | {
        from_column?: string;
      }[];
  gridGroupBy?: string | string[];
  kanbanGroupBy?: string;
}

export interface PredictNextFieldsType {
  title: string;
  type: string;
  options?: string[];
  description?: string | null;
}

export interface PredictNextFormulasType {
  title: string;
  formula: string;
  description?: string | null;
}

export function substituteColumnIdWithAliasInPrompt(
  prompt: string,
  columns: ColumnType[],
  rawPrompt?: string
): { substituted: string; missingIds: { id: string; title: string }[] } {
  const columnIdMap = columns.reduce((acc, col) => {
    acc[col.id] = col;
    return acc;
  }, {} as Record<string, ColumnType>);

  // Keep flexible regex: matches anything inside {}
  const regex = /{(.*?)}/g;

  const rawMatches = rawPrompt ? [...stringAllMatches(rawPrompt, regex)] : [];

  let matchIndex = 0;
  const missingIds: { id: string; title: string }[] = [];

  const substituted = (prompt || '').replace(regex, (fullMatch, key) => {
    const idx = matchIndex++; // always advance

    const column = columnIdMap[key];
    if (column) {
      return `{${column.title}}`;
    }

    const oldName = rawMatches[idx]?.[1];

    if (oldName) {
      // Nothing found → keep original and log it
      missingIds.push({
        id: key,
        title: oldName,
      });
      return `{${oldName}}`;
    }

    // Nothing found → keep original and log it
    missingIds.push({
      id: key,
      title: key,
    });

    return fullMatch;
  });

  return { substituted, missingIds };
}
