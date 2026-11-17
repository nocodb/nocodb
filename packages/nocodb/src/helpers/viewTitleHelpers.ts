import type { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/catchError';

// nc_views_v2.title is varchar(255)
export const VIEW_TITLE_MAX_LENGTH = 255;

// Code points, as varchar(n) counts them
const titleLength = (title: string) => [...title].length;

// Trims a view title and rejects empty or over-long ones.
export function normalizeViewTitle(context: NcContext, title: unknown): string {
  return normalizeTitle(
    context,
    typeof title === 'string' ? title : '',
    'View',
  );
}

// Same rule for workflows, scripts, dashboards and docs; a blank title takes `fallback` if given.
export function normalizeTitle(
  context: NcContext,
  title: unknown,
  label: string,
  fallback?: string,
): string {
  if (title !== undefined && title !== null && typeof title !== 'string') {
    NcError.get(context).invalidRequestBody(`${label} title must be text`);
  }
  const trimmed = (typeof title === 'string' ? title.trim() : '') || fallback;
  if (!trimmed) {
    NcError.get(context).invalidRequestBody(`${label} title is required`);
  }
  if (titleLength(trimmed) > VIEW_TITLE_MAX_LENGTH) {
    NcError.get(context).invalidRequestBody(
      `${label} title must be at most ${VIEW_TITLE_MAX_LENGTH} characters`,
    );
  }
  return trimmed;
}

// For duplicate/import: older bases can hold blank or over-long titles that
// normalizeViewTitle would reject, so cut or replace them instead.
export function repairCopiedViewTitles(views: { title?: string }[]) {
  const taken = new Set<string>();
  const blank: { title?: string }[] = [];
  for (const view of views) {
    let title = typeof view.title === 'string' ? view.title.trim() : '';
    if (titleLength(title) > VIEW_TITLE_MAX_LENGTH) {
      title = [...title].slice(0, VIEW_TITLE_MAX_LENGTH).join('').trim();
    }
    if (title) {
      view.title = title;
      taken.add(title);
    } else {
      blank.push(view);
    }
  }
  let n = 1;
  for (const view of blank) {
    let candidate: string;
    do {
      candidate = n === 1 ? 'Untitled view' : `Untitled view ${n}`;
      n++;
    } while (taken.has(candidate));
    view.title = candidate;
    taken.add(candidate);
  }
}
