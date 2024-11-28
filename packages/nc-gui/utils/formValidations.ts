import type { RuleObject } from 'ant-design-vue/es/form'
import isMobilePhone from 'validator/lib/isMobilePhone'
import { StringValidationType, UITypes } from 'nocodb-sdk'
import type { ColumnType, Validation } from 'nocodb-sdk'
import { getI18n } from '../plugins/a.i18n'

export const formEmailValidator = (val: Validation) => {
  return {
    validator: (_rule: RuleObject, value: any) => {
      return new Promise((resolve, reject) => {
        const { t } = getI18n().global

        if (value && !validateEmail(value)) {
          return reject(val.message || t('msg.error.invalidEmail'))
        }
        return resolve(true)
      })
    },
  }
}

export const formPhoneNumberValidator = (val: Validation) => {
  return {
    validator: (_rule: RuleObject, value: any) => {
      return new Promise((resolve, reject) => {
        const { t } = getI18n().global

        if (value && !isMobilePhone(value)) {
          return reject(val.message || t('msg.invalidPhoneNumber'))
        }
        return resolve(true)
      })
    },
  }
}

export const formUrlValidator = (val: Validation) => {
  return {
    validator: (_rule: RuleObject, value: any) => {
      return new Promise((resolve, reject) => {
        const { t } = getI18n().global

        if (value && !isValidURL(value)) {
          return reject(val.message || t('msg.error.invalidURL'))
        }
        return resolve(true)
      })
    },
  }
}

export const formNumberInputValidator = (cal: ColumnType) => {
  return {
    validator: (_rule: RuleObject, value: any) => {
      return new Promise((resolve, reject) => {
        const { t } = getI18n().global

        if (value && value !== '-' && !(cal.uidt === UITypes.Number ? /^-?\d+$/.test(value) : /^-?\d*\.?\d+$/.test(value))) {
          return reject(t('msg.plsEnterANumber'))
        }
        return resolve(true)
      })
    },
  }
}

export const requiredFieldValidatorFn = (value: unknown) => {
  value = unref(value)
  if (Array.isArray(value)) return !!value.length

  if (value === undefined || value === null) {
    return false
  }

  if (value === false) {
    return true
  }

  if (typeof value === 'object') {
    if (Object.keys(value).length > 0) {
      return true
    }

    return false
  }

  return !!String(value).length
}

export const isEmptyValidatorValue = (v: Validation) => {
  if (v.type === StringValidationType.Regex) {
    return v.type && typeof v.regex === 'string' ? !v.regex.trim() : v.regex === null
  } else if (v.type && v.value !== undefined) {
    return v.type && typeof v.value === 'string' ? !v.value.trim() : v.value === null
  }

  return false
}

export const extractFieldValidator = (_validators: Validation[], element: ColumnType) => {
  const rules: RuleObject[] = []

  // Add column default validators
  if ([UITypes.Number, UITypes.Currency, UITypes.Percent].includes(element.uidt)) {
    rules.push(formNumberInputValidator(element))
  }

  switch (element.uidt) {
    case UITypes.Email: {
      if (parseProp(element.meta).validate) {
        rules.push(
          formEmailValidator({
            type: StringValidationType.Email,
          }),
        )
      }
      break
    }
    case UITypes.PhoneNumber: {
      if (parseProp(element.meta).validate) {
        rules.push(
          formPhoneNumberValidator({
            type: StringValidationType.PhoneNumber,
          }),
        )
      }
      break
    }
    case UITypes.URL: {
      if (parseProp(element.meta).validate) {
        rules.push(
          formUrlValidator({
            type: StringValidationType.Url,
          }),
        )
      }
      break
    }
  }

  return rules
}

/**
 * @description:
 * This function sanitizes field names to ensure they are valid for form validation and avoid issues with nested object notation.
 * - Replaces dots ('.') with underscores ('_') because dot notation is used to access object properties in many form validation libraries (e.g., useForm),
 *   and having dots can cause the field to be treated as a nested object rather than a simple property.
 * - Replaces square brackets ('[]') with underscores ('_') to avoid the field being interpreted as an array or nested structure.
 *
 * This ensures the field names are flat, unique, and compatible with form validation libraries.
 * If the sanitized name already exists, a counter is appended to make it unique.
 */
export const getValidFieldName = (title: string, uniqueFieldNames: Set<string>) => {
  title = title.replace(/\./g, '_').replace(/\[|\]/g, '_')
  let counter = 1

  let newTitle = title
  while (uniqueFieldNames.has(newTitle)) {
    newTitle = `${title}_${counter}`
    counter++
  }
  uniqueFieldNames.add(newTitle)
  return newTitle
}
