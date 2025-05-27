import { ncIsUndefined } from './is';

const OVERFLOW_REPLACEMENT_REGEX = /\.\.\.\s?(\d*)$/;
const STRING_OVERFLOW_REPLACEMENT = '...{index}';

export async function appendToLength(param: {
  value: string;
  appendage: string;
  maxLength: number;
  isExists: (value: string) => Promise<boolean>;
}) {
  const { value, appendage, maxLength, isExists } = param;
  // if it's already in the form of truncated
  // skip with usual append
  if ((value + appendage).length > maxLength) {
    const existingIndex = value.match(OVERFLOW_REPLACEMENT_REGEX)?.[1];

    return truncateToLength({
      value,
      maxLength,
      currentIndex:
        !ncIsUndefined(existingIndex) && existingIndex !== ''
          ? Number(existingIndex)
          : undefined,
      isExists,
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
}) {
  const { value, currentIndex, maxLength, isExists } = param;
  const replacement = ncIsUndefined(currentIndex) ? '' : ` ${currentIndex}`;
  const suffix = STRING_OVERFLOW_REPLACEMENT.replace('{index}', replacement);
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
