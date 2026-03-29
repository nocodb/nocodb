import type { ColumnType } from 'nocodb-sdk'
import { validateEmail } from 'nocodb-sdk'
import validator from 'validator'
import { TypeConversionError } from '../error/type-conversion.error'
import { getI18n } from '../plugins/a.i18n'

export { validateEmail }

export const validateTableName = {
  validator: (_: unknown, value: string) => {
    return new Promise((resolve, reject) => {
      const { t } = getI18n().global

      if (!value) {
        // return 'Table name required'
        return reject(new Error(t('msg.error.tableNameRequired')))
      }

      // exclude . / \
      // rest all characters allowed
      // https://documentation.sas.com/doc/en/pgmsascdc/9.4_3.5/acreldb/n0rfg6x1shw0ppn1cwhco6yn09f7.htm#:~:text=By%20default%2C%20MySQL%20encloses%20column,not%20truncate%20a%20longer%20name.
      const m = value.match(/[./\\]/g)
      if (m) {
        // return `Following characters are not allowed ${m.map((c) => JSON.stringify(c)).join(', ')}`
        return reject(
          new Error(`${t('msg.error.followingCharactersAreNotAllowed')} ${m.map(c => JSON.stringify(c)).join(', ')}`),
        )
      }
      return resolve(true)
    })
  },
}

export const validateScriptName = {
  validator: (_: unknown, value: string) => {
    return new Promise((resolve, reject) => {
      const { t } = getI18n().global

      if (!value) {
        // return 'Table name required'
        return reject(new Error(t('msg.error.scriptNameRequired')))
      }

      if (value.length > 256) {
        return reject(new Error(t('msg.error.columnNameExceedsCharacters', { value: 256 })))
      }

      // exclude . / \
      // rest all characters allowed
      // https://documentation.sas.com/doc/en/pgmsascdc/9.4_3.5/acreldb/n0rfg6x1shw0ppn1cwhco6yn09f7.htm#:~:text=By%20default%2C%20MySQL%20encloses%20column,not%20truncate%20a%20longer%20name.
      const m = value.match(/[./\\]/g)
      if (m) {
        // return `Following characters are not allowed ${m.map((c) => JSON.stringify(c)).join(', ')}`
        return reject(
          new Error(`${t('msg.error.followingCharactersAreNotAllowed')} ${m.map(c => JSON.stringify(c)).join(', ')}`),
        )
      }
      return resolve(true)
    })
  },
}

export const validateWorkflowName = {
  validator: (_: unknown, value: string) => {
    return new Promise((resolve, reject) => {
      const { t } = getI18n().global

      if (!value) {
        // return 'Table name required'
        return reject(new Error(t('msg.error.workflowNameRequired')))
      }

      if (value.length > 256) {
        return reject(new Error(t('msg.error.workflowNameExceedsCharacters', { value: 256 })))
      }

      // exclude . / \
      // rest all characters allowed
      // https://documentation.sas.com/doc/en/pgmsascdc/9.4_3.5/acreldb/n0rfg6x1shw0ppn1cwhco6yn09f7.htm#:~:text=By%20default%2C%20MySQL%20encloses%20column,not%20truncate%20a%20longer%20name.
      const m = value.match(/[./\\]/g)
      if (m) {
        // return `Following characters are not allowed ${m.map((c) => JSON.stringify(c)).join(', ')}`
        return reject(
          new Error(`${t('msg.error.followingCharactersAreNotAllowed')} ${m.map(c => JSON.stringify(c)).join(', ')}`),
        )
      }
      return resolve(true)
    })
  },
}

export const validateDashboardName = {
  validator: (_: unknown, value: string) => {
    return new Promise((resolve, reject) => {
      const { t } = getI18n().global

      if (!value) {
        return reject(new Error(t('msg.error.dashboardNameRequired')))
      }

      if (value.length > 256) {
        return reject(new Error(t('msg.error.dashboardNameExceedsCharacters', { value: 256 })))
      }

      const m = value.match(/[./\\]/g)
      if (m) {
        return reject(
          new Error(`${t('msg.error.followingCharactersAreNotAllowed')} ${m.map(c => JSON.stringify(c)).join(', ')}`),
        )
      }
      return resolve(true)
    })
  },
}

export const validateTeamName = {
  validator: (_: unknown, value: string) => {
    return new Promise((resolve, reject) => {
      const { t } = getI18n().global

      if (!value) {
        return reject(new Error(t('msg.error.teamNameRequired')))
      }

      if (value.length > 256) {
        return reject(new Error(t('msg.error.teamNameExceedsCharacters', { value: 256 })))
      }

      const m = value.match(/[./\\]/g)
      if (m) {
        return reject(
          new Error(`${t('msg.error.followingCharactersAreNotAllowed')} ${m.map(c => JSON.stringify(c)).join(', ')}`),
        )
      }
      return resolve(true)
    })
  },
}

export const validateColumnName = {
  validator: (_: unknown, value: string) => {
    return new Promise((resolve, reject) => {
      const { t } = getI18n().global

      if (!value) {
        // return 'Column name required'
        return reject(new Error(t('msg.error.columnNameRequired')))
      }

      // exclude . / \
      // rest all characters allowed
      // https://documentation.sas.com/doc/en/pgmsascdc/9.4_3.5/acreldb/n0rfg6x1shw0ppn1cwhco6yn09f7.htm#:~:text=By%20default%2C%20MySQL%20encloses%20column,not%20truncate%20a%20longer%20name.
      const m = value.match(/[./\\]/g)
      if (m) {
        // return `Following characters are not allowed ${m.map((c) => JSON.stringify(c)).join(', ')}`
        return reject(
          new Error(`${t('msg.error.followingCharactersAreNotAllowed')} ${m.map(c => JSON.stringify(c)).join(', ')}`),
        )
      }
      return resolve(true)
    })
  },
}

export const layoutTitleValidator = {
  validator: (rule: any, value: any) => {
    const { t } = getI18n().global

    return new Promise((resolve, reject) => {
      if (value?.length > 250) {
        reject(new Error(t('msg.error.layoutNameExceeds50Characters')))
      }

      if (value[0] === ' ') {
        reject(new Error(t('msg.error.layoutNameCannotStartWithSpace')))
      }

      resolve(true)
    })
  },
}

export function baseTitleValidator(title: string = 'objects.project') {
  return {
    validator: (rule: any, value: any) => {
      const { t } = getI18n().global

      return new Promise((resolve, reject) => {
        if (value?.length > 50) {
          reject(
            new Error(
              t('msg.error.projectNameExceeds50Characters', {
                title: t(title),
              }),
            ),
          )
        }

        if (value[0] === ' ') {
          reject(
            new Error(
              t('msg.error.projectNameCannotStartWithSpace', {
                title: t(title),
              }),
            ),
          )
        }

        resolve(true)
      })
    },
  }
}

export function fieldRequiredValidator() {
  const { t } = getI18n().global
  return {
    required: true,
    // message: `Required field`,
    message: t('msg.error.requiredField'),
  }
}

export function fieldLengthValidator() {
  return {
    validator: (rule: any, value: any) => {
      const { t } = getI18n().global

      /// mysql allows 64 characters for column_name
      // postgres allows 59 characters for column_name
      // sqlite allows any number of characters for column_name
      // We allow 255 for all databases, truncate will be handled by backend for column_name
      const fieldLengthLimit = 255

      return new Promise((resolve, reject) => {
        if (value?.length > fieldLengthLimit) {
          reject(new Error(t('msg.error.columnNameExceedsCharacters', { value: fieldLengthLimit })))
        }
        resolve(true)
      })
    },
  }
}
export function reservedFieldNameValidator() {
  return {
    validator: (rule: any, value: any) => {
      const { t } = getI18n().global

      return new Promise((resolve, reject) => {
        if (value?.toLowerCase() === 'id') {
          reject(new Error(t('msg.error.duplicateSystemColumnName')))
        }
        resolve(true)
      })
    },
  }
}

export const importUrlValidator = {
  validator: (rule: any, value: any) => {
    return new Promise((resolve, reject) => {
      const { t } = getI18n().global
      if (
        /(10)(\.(2([0-5][0-5]|[0-4][6-9])|1\d\d|[1-9]\d|\d)){3}|(172)\.(1[6-9]|2\d|3[01])(\.(2[0-4]\d|25[0-5]|1\d\d|[1-9]\d|\d)){2}|(192)\.(168)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){2}|(0.0.0.0)|localhost?/.test(
          value,
        )
      ) {
        // return reject(new Error('IP Not allowed!'))
        return reject(new Error(t('msg.error.ipNotAllowed')))
      }
      return resolve(true)
    })
  },
}

export const importCsvUrlValidator = {
  validator: (rule: any, value: any) => {
    return new Promise((resolve, reject) => {
      const { t } = getI18n().global
      if (value && !/.*\.(csv)/.test(value)) {
        // return reject(new Error('Target file is not an accepted file type. The accepted file type is .csv!'))
        return reject(
          new Error(`${t('msg.error.targetFileIsNotAnAcceptedFileType')}. ${t('msg.error.theAcceptedFileTypeIsCsv')}`),
        )
      }
      return resolve(true)
    })
  },
}

export const importExcelUrlValidator = {
  validator: (rule: any, value: any) => {
    return new Promise((resolve, reject) => {
      const { t } = getI18n().global
      if (value && !/.*\.(xls|xlsx|xlsm|ods|ots)/.test(value)) {
        return reject(
          // new Error('Target file is not an accepted file type. The accepted file types are .xls, .xlsx, .xlsm, .ods, .ots!'),
          new Error(
            `${t('msg.error.targetFileIsNotAnAcceptedFileType')}. ${t('msg.error.theAcceptedFileTypesAreXlsXlsxXlsmOdsOts')}`,
          ),
        )
      }
      return resolve(true)
    })
  },
}

export const extraParameterValidator = {
  validator: (_: unknown, value: { key: string, value: string }[]) => {
    return new Promise((resolve, reject) => {
      const { t } = getI18n().global
      for (const param of value) {
        if (!value.every(el => el.key === '') && value.filter((el: any) => el.key === param.key).length !== 1) {
          // return reject(new Error('Duplicate parameter keys are not allowed'))
          return reject(new Error(t('msg.error.duplicateParameterKeysAreNotAllowed')))
        }
      }
      return resolve(true)
    })
  },
}

export const emailValidator = {
  validator: (_: unknown, value: string) => {
    return new Promise((resolve, reject) => {
      if (!value || value.length === 0) {
        return reject(new Error('Email is required'))
      }
      const invalidEmails = (value || '').split(/\s*,\s*/).filter((e: string) => !validateEmail(e))
      if (invalidEmails.length > 0) {
        return reject(
          new Error(`${invalidEmails.length > 1 ? ' Invalid emails:' : 'Invalid email:'} ${invalidEmails.join(', ')} `),
        )
      }
      return resolve(true)
    })
  },
}

export const urlValidator = {
  validator: (_: unknown, v: string) => {
    return new Promise((resolve, reject) => {
      const { t } = getI18n().global

      if (!v.length || isValidURL(v)) return resolve(true)

      reject(new Error(t('msg.error.invalidURL')))
    })
  },
}

export function validateColumnValue(column: ColumnType, value: any) {
  if (value === undefined || value === null || value === '') return
  const metaValidate = (column.meta as any)?.validate
  const validate = (column as any).validate
  if (validate && metaValidate) {
    let validateObj: any
    try {
      validateObj = JSON.parse(validate)
    }
    catch (ex) {}
    if (validateObj.func?.[0] && validator[validateObj.func[0] as string]) {
      const validatorFunc = validator[validateObj.func[0] as any]
      const validationResult = validatorFunc(value)
      if (!validationResult) {
        throw new TypeConversionError(`Invalid value`)
      }
    }
  }
}
