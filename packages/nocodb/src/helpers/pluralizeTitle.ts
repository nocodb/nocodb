import { pluralize } from 'inflection';

// inflection appends "s" to whatever ends the string ("Items 1670" -> "Items 1670s"), so only pluralise a trailing word.
export function pluralizeTitle(title: string): string {
  if (!title || !/\p{Script=Latin}$/u.test(title.trim())) return title;

  return pluralize(title);
}
