import { getI18n } from '~/plugins/a.i18n'

export const validateEmail = (v: string) =>
  /^(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@(([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{2,})$/i.test(v)

export function validateTableName(v: string, isGQL = false) {
  const { t } = getI18n().global

  if (!v) {
    // return 'Table name required'
    return t('msg.error.tableNameRequired')
  }

  // GraphQL naming convention
  // http://spec.graphql.org/June2018/#Name

  if (isGQL) {
    if (/^[_A-Za-z][_0-9A-Za-z]*$/.test(v)) {
      return true
    }

    if (/^[^_A-Za-z]/.test(v)) {
      // return 'Name should start with an alphabet or _'
      return t('msg.error.nameShouldStartWithAnAlphabetOr_')
    }
    const m = v.match(/[^_A-Za-z\d]/g)
    if (m) {
      // return `Following characters are not allowed ${m.map((c) => JSON.stringify(c)).join(', ')}`
      return `${t('msg.error.followingCharactersAreNotAllowed')} ${m.map((c) => JSON.stringify(c)).join(', ')}`
    }
  } else {
    // exclude . / \
    // rest all characters allowed
    // https://documentation.sas.com/doc/en/pgmsascdc/9.4_3.5/acreldb/n0rfg6x1shw0ppn1cwhco6yn09f7.htm#:~:text=By%20default%2C%20MySQL%20encloses%20column,not%20truncate%20a%20longer%20name.
    const m = v.match(/[./\\]/g)
    if (m) {
      // return `Following characters are not allowed ${m.map((c) => JSON.stringify(c)).join(', ')}`
      return `${t('msg.error.followingCharactersAreNotAllowed')} ${m.map((c) => JSON.stringify(c)).join(', ')}`
    }

    return true
  }
}

export function validateColumnName(v: string, isGQL = false) {
  const { t } = getI18n().global
  if (!v) {
    // return 'Column name required'
    return t('msg.error.columnNameRequired')
  }

  // GraphQL naming convention
  // http://spec.graphql.org/June2018/#Name
  if (isGQL) {
    if (/^[_A-Za-z][_0-9A-Za-z]*$/.test(v)) {
      return true
    }

    if (/^[^_A-Za-z]/.test(v)) {
      // return 'Name should start with an alphabet or _'
      return t('msg.error.nameShouldStartWithAnAlphabetOr_')
    }
    const m = v.match(/[^_A-Za-z\d]/g)
    if (m) {
      // return `Following characters are not allowed ${m.map((c) => JSON.stringify(c)).join(', ')}`
      return `${t('msg.error.followingCharactersAreNotAllowed')} ${m.map((c) => JSON.stringify(c)).join(', ')}`
    }
  } else {
    // exclude . / \
    // rest all characters allowed
    // https://documentation.sas.com/doc/en/pgmsascdc/9.4_3.5/acreldb/n0rfg6x1shw0ppn1cwhco6yn09f7.htm#:~:text=By%20default%2C%20MySQL%20encloses%20column,not%20truncate%20a%20longer%20name.
    const m = v.match(/[./\\]/g)
    if (m) {
      // return `Following characters are not allowed ${m.map((c) => JSON.stringify(c)).join(', ')}`
      return `${t('msg.error.followingCharactersAreNotAllowed')} ${m.map((c) => JSON.stringify(c)).join(', ')}`
    }

    return true
  }
}

export const projectTitleValidator = {
  validator: (rule: any, value: any) => {
    const { t } = getI18n().global

    return new Promise((resolve, reject) => {
      if (value?.length > 50) {
        reject(new Error(t('msg.error.projectNameExceeds50Characters')))
      }

      if (value[0] === ' ') {
        reject(new Error(t('msg.error.projectNameCannotStartWithSpace')))
      }

      resolve(true)
    })
  },
}

export const fieldRequiredValidator = () => {
  const { t } = getI18n().global
  return {
    required: true,
    // message: `Required field`,
    message: t('msg.error.requiredField'),
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
        if (param.key === '') {
          // return reject(new Error('Parameter key cannot be empty'))
          return reject(new Error(t('msg.error.parameterKeyCannotBeEmpty')))
        }
        if (value.filter((el: any) => el.key === param.key).length !== 1) {
          // return reject(new Error('Duplicate parameter keys are not allowed'))
          return reject(new Error(t('msg.error.duplicateParameterKeysAreNotAllowed')))
        }
      }
      return resolve(true)
    })
  },
}
