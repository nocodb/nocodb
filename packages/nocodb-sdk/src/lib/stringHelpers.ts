import { ncIsUndefined } from './is';

const AppendToLengthSuffixConfig = {
  _: {
    replacement: '___{index}',
    replacementRegex: /___\s?(\d*)$/,
  },
  dot: {
    replacement: '...{index}',
    replacementRegex: /\.\.\.\s?(\d*)$/,
  },
};
export enum AppendToLengthSuffix {
  _ = '_',
  dot = 'dot',
}

/**
 * get a row & column given a numeric position
 * row & column start at 0
 */
export function getRowColPositionFromIndex({
  stack,
  position,
}: {
  stack: string;
  position: number;
}) {
  const parts = stack.substring(0, position).split('\n');
  return {
    column: parts[parts.length - 1].length,
    row: parts.length - 1,
  };
}

export async function appendToLength(param: {
  value: string;
  appendage: string;
  maxLength: number;
  isExists: (value: string) => Promise<boolean>;
  suffix?: AppendToLengthSuffix;
}) {
  const { value, appendage, maxLength, isExists } = param;
  const suffixConfig =
    AppendToLengthSuffixConfig[param.suffix ?? AppendToLengthSuffix.dot];

  // if it's already in the form of truncated
  // skip with usual append
  if ((value + appendage).length > maxLength) {
    const existingIndex = value.match(suffixConfig.replacementRegex)?.[1];

    return truncateToLength({
      value,
      maxLength,
      currentIndex:
        !ncIsUndefined(existingIndex) && existingIndex !== ''
          ? Number(existingIndex)
          : undefined,
      isExists,
      suffix: param.suffix,
    });
  }

  let currentIndex: number | undefined = 1;
  let needle = value + appendage;

  while (await isExists(needle)) {
    needle = value + appendage + '_' + currentIndex++;
    if (needle.length >= maxLength) {
      return appendToLength({
        ...param,
        appendage: appendage + '_' + currentIndex++,
        suffix: param.suffix,
      });
    }
  }
  return needle;
}

export async function truncateToLength(param: {
  value: string;
  maxLength: number;
  currentIndex?: number;
  isExists: (value: string) => Promise<boolean>;
  suffix?: AppendToLengthSuffix;
}) {
  const { value, currentIndex, maxLength, isExists } = param;
  const suffixConfig =
    AppendToLengthSuffixConfig[param.suffix ?? AppendToLengthSuffix.dot];
  const replacement = ncIsUndefined(currentIndex) ? '' : `${currentIndex}`;
  const suffix = suffixConfig.replacement.replace('{index}', replacement);
  const needle = value.substring(0, maxLength - suffix.length) + suffix;
  if (!(await isExists(needle))) {
    return needle;
  } else {
    return truncateToLength({
      ...param,
      currentIndex: ncIsUndefined(currentIndex) ? 2 : currentIndex + 1,
    });
  }
}

/**
 * Generates a unique copy name by checking against existing names/items
 */
export function generateUniqueCopyName<T = string>(
  originalName: string,
  existing: T[] | string[],
  options: {
    /** Property name or accessor function to get the name from objects */
    accessor?: keyof T | ((item: T) => string);
    /** Prefix to use (default: "Copy of") */
    prefix?: string;
    /** Separator before counter (default: " ") */
    separator?: string;
    /** Format for counter, use {counter} placeholder (default: "({counter})") */
    counterFormat?: string;
  } = {}
): string {
  const {
    accessor,
    prefix = 'Copy of',
    separator = ' ',
    counterFormat = '({counter})',
  } = options;

  // Extract names from the existing array
  const existingNames = existing.map((item) => {
    if (typeof item === 'string') return item;
    if (accessor) {
      return typeof accessor === 'function'
        ? accessor(item)
        : String(item[accessor]);
    }
    // Default to 'title' property if no accessor specified
    return String((item as any).title);
  });

  const getPrefix = () => {
    return prefix ? `${prefix} ` : (prefix ?? '');
  };
  let newName = `${getPrefix()}${originalName}`;
  let counter = 1;

  while (existingNames.includes(newName)) {
    const counterText = counterFormat.replace('{counter}', counter.toString());
    newName = `${getPrefix()}${originalName}${separator}${counterText}`;
    counter++;
  }

  return newName;
}

export function escapeRegexString(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Trim matching quotes from the string
 * @param str - The string to trim
 * @returns The trimmed string
 */
export const trimMatchingQuotes = (str?: string | null): string => {
  if (!str?.trim()) return '';

  return str?.trim()?.replace(/^(['"])(.*)\1$/, '$2') ?? '';
};

/**
 * Get all matches of a regex in a string
 * @param str - The string to search
 * @param regex - The regular expression to match against
 * @returns An array of all matches of the regex in the string
 *
 * Note: Since we are using ES2017, `String.prototype.matchAll` is not available.
 * This function acts as a fallback to achieve the same behavior.
 */
export function stringAllMatches(
  str: string,
  regex: RegExp
): RegExpExecArray[] {
  // Ensure regex has the global flag, because exec() needs it to iterate
  const globalRegex = new RegExp(
    regex.source,
    regex.flags.includes('g') ? regex.flags : regex.flags + 'g'
  );

  const matches: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;

  while ((m = globalRegex.exec(str)) !== null) {
    matches.push(m);
  }

  return matches;
}
