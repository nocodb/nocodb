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
