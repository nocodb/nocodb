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

  let newName = `${prefix} ${originalName}`;
  let counter = 1;

  while (existingNames.includes(newName)) {
    const counterText = counterFormat.replace('{counter}', counter.toString());
    newName = `${prefix} ${originalName}${separator}${counterText}`;
    counter++;
  }

  return newName;
}
