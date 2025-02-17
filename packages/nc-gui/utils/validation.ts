import type { ColumnType } from 'nocodb-sdk'
import validator from 'validator'
import { getI18n } from '../plugins/a.i18n'
import { TypeConversionError } from '../error/type-conversion.error'

export const validateEmail = (v: string) =>
  /^(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@(([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{2,})$/i.test(v)

export const validateTableName = {
  validator: (_: unknown, value: string) => {
    return new Promise((resolve, reject) => {
      const { t } = getI18n().global

      if (!value) {
        // return 'Table name required'
        return reject(new Error(t('msg.error.tableNameRequired')))
      }

      if (value.length > 52) {
        return reject(new Error(t('msg.error.columnNameExceedsCharacters', { value: 52 })))
      }

      // exclude . / \
      // rest all characters allowed
      // https://documentation.sas.com/doc/en/pgmsascdc/9.4_3.5/acreldb/n0rfg6x1shw0ppn1cwhco6yn09f7.htm#:~:text=By%20default%2C%20MySQL%20encloses%20column,not%20truncate%20a%20longer%20name.
      const m = value.match(/[./\\]/g)
      if (m) {
        // return `Following characters are not allowed ${m.map((c) => JSON.stringify(c)).join(', ')}`
        return reject(
          new Error(`${t('msg.error.followingCharactersAreNotAllowed')} ${m.map((c) => JSON.stringify(c)).join(', ')}`),
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
          new Error(`${t('msg.error.followingCharactersAreNotAllowed')} ${m.map((c) => JSON.stringify(c)).join(', ')}`),
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
          new Error(`${t('msg.error.followingCharactersAreNotAllowed')} ${m.map((c) => JSON.stringify(c)).join(', ')}`),
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

export const baseTitleValidator = (title: 'project' | 'connection' = 'project') => {
  return {
    validator: (rule: any, value: any) => {
      const { t } = getI18n().global

      return new Promise((resolve, reject) => {
        if (value?.length > 50) {
          reject(
            new Error(
              t('msg.error.projectNameExceeds50Characters', {
                title: title === 'project' ? t('objects.project') : t('general.connection'),
              }),
            ),
          )
        }

        if (value[0] === ' ') {
          reject(
            new Error(
              t('msg.error.projectNameCannotStartWithSpace', {
                title: title === 'project' ? t('objects.project') : t('general.connection'),
              }),
            ),
          )
        }

        resolve(true)
      })
    },
  }
}

export const fieldRequiredValidator = () => {
  const { t } = getI18n().global
  return {
    required: true,
    // message: `Required field`,
    message: t('msg.error.requiredField'),
  }
}

export const fieldLengthValidator = () => {
  return {
    validator: (rule: any, value: any) => {
      const { t } = getI18n().global

      /// mysql allows 64 characters for column_name
      // postgres allows 59 characters for column_name
      // mssql allows 128 characters for column_name
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
export const reservedFieldNameValidator = () => {
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
        /(10)(\.([2]([0-5][0-5]|[01234][6-9])|[1][0-9][0-9]|[1-9][0-9]|[0-9])){3}|(172)\.(1[6-9]|2[0-9]|3[0-1])(\.(2[0-4][0-9]|25[0-5]|[1][0-9][0-9]|[1-9][0-9]|[0-9])){2}|(192)\.(168)(\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])){2}|(0.0.0.0)|localhost?/g.test(
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
  validator: (_: unknown, value: { key: string; value: string }[]) => {
    return new Promise((resolve, reject) => {
      const { t } = getI18n().global
      for (const param of value) {
        if (!value.every((el) => el.key === '') && value.filter((el: any) => el.key === param.key).length !== 1) {
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

export const validateColumnValue = (column: ColumnType, value: any) => {
  if (value === undefined || value === null || value === '') return
  const metaValidate = (column.meta as any)?.validate
  const validate = (column as any).validate
  if (validate && metaValidate) {
    let validateObj: any
    try {
      validateObj = JSON.parse(validate)
    } catch (ex) {}
    if (validateObj.func?.[0] && validator[validateObj.func[0] as string]) {
      const validatorFunc = validator[validateObj.func[0] as any]
      const validationResult = validatorFunc(value)
      if (!validationResult) {
        throw new TypeConversionError(`Invalid value`)
      }
    }
  }
}
