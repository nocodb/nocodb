import dayjs from 'dayjs';
import isMobilePhone from 'validator/lib/isMobilePhone';
import {
  AttachmentValidationType,
  DateValidationType,
  isLink,
  isValidURL,
  NumberValidationType,
  SelectValidationType,
  StringValidationType,
  TimeValidationType,
  UITypes,
  validateEmail,
  YearValidationType,
} from 'nocodb-sdk';
import type { ColumnType, Validation } from 'nocodb-sdk';

/**
 * Server-side evaluation of a form field's `meta.validators`.
 *
 * The Enterprise form renderer evaluates the same rules in the browser
 * (`nc-gui/ee/utils/formValidations.ts`); this exists because nothing stopped
 * a direct POST to the shared-form endpoint from bypassing them.
 *
 * Two deliberate properties:
 *
 * - **It mirrors the renderer, including its leniency.** Every client rule
 *   short-circuits to "valid" on an empty value, so emptiness is `required`'s
 *   business, not a validator's.
 * - **It fails open.** An unrecognised rule type, an unparseable configured
 *   value or a value shape it cannot read is skipped rather than rejected.
 *   A false negative lets one bad submission through; a false positive
 *   silently breaks a live public form.
 *
 * Two rules are deliberately left to the browser:
 *
 * - `businessEmail` needs `company-email-validator`, a frontend dependency.
 * - `regex` runs an author-supplied pattern, and a backtracking one
 *   (`^(a+)+$` and friends) takes minutes on a short input. This endpoint is
 *   public and Node is single-threaded, so one submission would freeze the
 *   whole process — and a hang is not something the try/catch below can
 *   recover from. It stays where it started: in the filler's own browser,
 *   where a runaway pattern costs only that tab.
 */

/**
 * Validator types the paid `FEATURE_FORM_FIELD_VALIDATION` covers.
 *
 * `PublicMetasService.validateFormViewPlanLimitAndFeatures` strips these from
 * the shared-view meta when the workspace's plan does not include the feature,
 * so the renderer never applies them — and neither may the submit path, or the
 * form would reject for a rule the filler cannot see. Email / url / phoneNumber
 * are a column-level validation available on every plan, and so is limiting
 * select options, which is why they are absent here.
 */
export const isPlanGatedValidator = (type: Validation['type']) => {
  if (
    (
      [
        ...Object.values(NumberValidationType),
        ...Object.values(DateValidationType),
        ...Object.values(TimeValidationType),
        ...Object.values(YearValidationType),
        ...Object.values(AttachmentValidationType),
      ] as string[]
    ).includes(type as string)
  ) {
    return true;
  }

  if (
    (
      [
        SelectValidationType.MinSelected,
        SelectValidationType.MaxSelected,
      ] as string[]
    ).includes(type as string)
  ) {
    return true;
  }

  return (
    (Object.values(StringValidationType) as string[]).includes(
      type as string,
    ) &&
    !(
      [
        StringValidationType.Email,
        StringValidationType.Url,
        StringValidationType.PhoneNumber,
      ] as string[]
    ).includes(type as string)
  );
};

/**
 * Mirrors `isEmptyValidatorValue` in `nc-gui/utils/formValidations.ts`: the
 * renderer drops a rule whose configured value is blank before it ever builds
 * one, so a half-filled rule in the editor must not reject a submission here.
 */
const isUnconfigured = (rule: Validation) => {
  const configured = rule.value;

  if (configured === undefined) return false;
  if (configured === null) return true;

  return typeof configured === 'string' ? !configured.trim() : false;
};

const isBlank = (value: unknown) =>
  value === null ||
  value === undefined ||
  value === '' ||
  (Array.isArray(value) && !value.length);

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

// Attachment cells arrive either already-parsed or as the JSON string the
// insert path builds.
const toAttachments = (value: unknown): any[] | null => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
};

const countSelected = (value: unknown, column: ColumnType): number | null => {
  if (Array.isArray(value)) return value.length;
  // a link cell that is not an array is unevaluable, as in the renderer — only
  // the comma-joined select/user encoding can be counted from a string
  if (isLink(column)) return null;
  if (typeof value === 'string') return value ? value.split(',').length : 0;
  return null;
};

const matchesMimePattern = (mimetype: string, pattern: string) => {
  const [type, subtype] = pattern.split('/');
  const [actualType, actualSubtype] = mimetype.split('/');
  return type === actualType && (subtype === '*' || subtype === actualSubtype);
};

// Read the date literal as written: re-formatting through the server's
// timezone moves the wall clock, and a day-wrap then inverts the comparison.
const DATE_LITERAL = /\d{4}-\d{2}-\d{2}/;
const TIME_LITERAL = /(\d{1,2}):(\d{2})(?::(\d{2}))?/;

const asDate = (input: unknown) => {
  const match =
    typeof input === 'string' ? DATE_LITERAL.exec(input) : undefined;
  return match ? dayjs(match[0]) : dayjs(null);
};

const asTime = (input: unknown) => {
  const match =
    typeof input === 'string' ? TIME_LITERAL.exec(input) : undefined;
  if (!match) return dayjs(null);
  const [, hour, minute, second] = match;
  return dayjs(
    `1999-01-01 ${hour.padStart(2, '0')}:${minute}:${second ?? '00'}`,
  );
};

/**
 * @returns the failure message, or null when the rule passes / cannot be
 * evaluated.
 */
function evaluateRule(
  rule: Validation,
  value: unknown,
  column: ColumnType,
): string | null {
  const fail = (fallback: string) => rule.message || fallback;
  const configured = rule.value;

  switch (rule.type) {
    case StringValidationType.MinLength: {
      const min = toNumber(configured);
      if (min === null || min <= 0) return null;
      return String(value).length < min
        ? fail(`The input must be at least ${min} characters long.`)
        : null;
    }
    case StringValidationType.MaxLength: {
      const max = toNumber(configured);
      if (max === null) return null;
      return String(value).length > max
        ? fail(`The input must not exceed ${max} characters.`)
        : null;
    }
    case StringValidationType.StartsWith:
      if (typeof configured !== 'string') return null;
      return !String(value).startsWith(configured)
        ? fail(`The input must start with '${configured}'.`)
        : null;
    case StringValidationType.EndsWith:
      if (typeof configured !== 'string') return null;
      return !String(value).endsWith(configured)
        ? fail(`The input must end with '${configured}'.`)
        : null;
    case StringValidationType.Includes:
      if (typeof configured !== 'string') return null;
      return !String(value).includes(configured)
        ? fail(`The input must contain the string '${configured}'.`)
        : null;
    case StringValidationType.NotIncludes:
      if (typeof configured !== 'string') return null;
      return String(value).includes(configured)
        ? fail(`The input must not contain the string '${configured}'.`)
        : null;
    // the SDK helpers, not validator/lib/*, because the renderer calls exactly
    // these — bare isEmail/isURL reject mailto:, file://, and local parts the
    // browser accepts
    case StringValidationType.Email:
      return !validateEmail(String(value))
        ? fail('Invalid email address')
        : null;
    case StringValidationType.PhoneNumber:
      return !isMobilePhone(String(value))
        ? fail('Invalid phone number')
        : null;
    case StringValidationType.Url:
      return !isValidURL(String(value)) ? fail('Invalid URL') : null;

    case NumberValidationType.Min:
    case YearValidationType.MinYear: {
      const min = toNumber(configured);
      const actual = toNumber(value);
      if (min === null || actual === null) return null;
      return actual < min ? fail(`The value must be at least ${min}.`) : null;
    }
    case NumberValidationType.Max:
    case YearValidationType.MaxYear: {
      const max = toNumber(configured);
      const actual = toNumber(value);
      if (max === null || actual === null) return null;
      return actual > max ? fail(`The value must not exceed ${max}.`) : null;
    }

    case SelectValidationType.MinSelected: {
      const min = toNumber(configured);
      const count = countSelected(value, column);
      if (min === null || count === null) return null;
      return count < min ? fail(`Select at least ${min} option(s).`) : null;
    }
    case SelectValidationType.MaxSelected: {
      const max = toNumber(configured);
      const count = countSelected(value, column);
      if (max === null || count === null) return null;
      return count > max ? fail(`Select at most ${max} option(s).`) : null;
    }

    case DateValidationType.MinDate:
    case DateValidationType.MaxDate: {
      if (typeof configured !== 'string') return null;
      const bound = asDate(configured);
      const actual = asDate(value);
      if (!bound.isValid() || !actual.isValid()) return null;
      // A DateTime cell is submitted in UTC, but the renderer compares the
      // filler's local date, which can sit a day either side. The server
      // cannot know that offset, so allow a day of slack.
      const slackDays = column.uidt === UITypes.Date ? 0 : 1;
      if (rule.type === DateValidationType.MinDate) {
        return actual.isBefore(bound.subtract(slackDays, 'day'))
          ? fail(`The date must be on or after ${configured}.`)
          : null;
      }
      return actual.isAfter(bound.add(slackDays, 'day'))
        ? fail(`The date must be on or before ${configured}.`)
        : null;
    }

    case TimeValidationType.MinTime:
    case TimeValidationType.MaxTime: {
      if (typeof configured !== 'string') return null;
      const bound = asTime(configured);
      const actual = asTime(value);
      if (!bound.isValid() || !actual.isValid()) return null;
      if (rule.type === TimeValidationType.MinTime) {
        return actual.isBefore(bound)
          ? fail(`The time must be at or after ${configured}.`)
          : null;
      }
      return actual.isAfter(bound)
        ? fail(`The time must be at or before ${configured}.`)
        : null;
    }

    case AttachmentValidationType.FileCount: {
      const max = toNumber(configured);
      const files = toAttachments(value);
      if (max === null || max <= 0 || files === null) return null;
      return files.length > max
        ? fail(`The file count must not exceed ${max}.`)
        : null;
    }
    case AttachmentValidationType.FileSize: {
      // the rule is stored in kilobytes (`FileSizeValidation.value` in the SDK);
      // `rule.unit` only decides how the editor displays it
      const maxKb = toNumber(configured);
      const files = toAttachments(value);
      if (maxKb === null || maxKb <= 0 || files === null) return null;
      const maxBytes = maxKb * 1024;
      return files.some((file) => {
        const size = toNumber(file?.size);
        return size !== null && size > maxBytes;
      })
        ? fail(`Each file must be ${maxKb} KB or smaller.`)
        : null;
    }
    case AttachmentValidationType.FileTypes: {
      const allowed = Array.isArray(configured) ? configured : null;
      const files = toAttachments(value);
      if (!allowed?.length || files === null) return null;
      const invalid = files
        .map((file) => file?.mimetype)
        .filter(
          (mimetype) =>
            typeof mimetype === 'string' &&
            !allowed.some(
              (pattern) =>
                typeof pattern === 'string' &&
                (pattern === mimetype || matchesMimePattern(mimetype, pattern)),
            ),
        );
      return invalid.length
        ? fail(`Only these file types are allowed: ${allowed.join(', ')}.`)
        : null;
    }

    // regex, businessEmail and anything the renderer has since gained are
    // skipped — see the note at the top of this file
    default:
      return null;
  }
}

/** Every failing rule for one field. */
export function evaluateFormFieldValidators(
  validators: Validation[] | undefined,
  value: unknown,
  column: ColumnType,
): string[] {
  if (!Array.isArray(validators) || !validators.length) return [];
  // the renderer treats an empty value as every validator's pass case
  if (isBlank(value)) return [];

  return validators
    .map((rule) => {
      if (!rule?.type || isUnconfigured(rule)) return null;
      try {
        return evaluateRule(rule, value, column);
      } catch {
        // never let a malformed rule turn into a 500 on a public endpoint
        return null;
      }
    })
    .filter((message): message is string => !!message);
}
