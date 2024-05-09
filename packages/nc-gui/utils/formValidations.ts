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

        if (value && !(cal.uidt === UITypes.Number ? /^-?\d+$/.test(value) : /^-?\d*\.?\d+$/.test(value))) {
          return reject(t('msg.plsEnterANumber'))
        }
        return resolve(true)
      })
    },
  }
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
