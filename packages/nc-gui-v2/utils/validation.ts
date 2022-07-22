export const isEmail = (v: string) =>
  /^(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@(([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{2,})$/i.test(v)

export function validateTableName(v: string, isGQL = false) {
  if (!v) {
    return 'Table name required'
  }

  // GraphQL naming convention
  // http://spec.graphql.org/June2018/#Name

  if (isGQL) {
    if (/^[_A-Za-z][_0-9A-Za-z]*$/.test(v)) {
      return true
    }

    if (/^[^_A-Za-z]/.test(v)) {
      return 'Name should start with an alphabet or _'
    }
    const m = v.match(/[^_A-Za-z\d]/g)
    if (m) {
      return `Following characters are not allowed ${m.map((c) => JSON.stringify(c)).join(', ')}`
    }
  } else {
    // exclude . / \
    // rest all characters allowed
    // https://documentation.sas.com/doc/en/pgmsascdc/9.4_3.5/acreldb/n0rfg6x1shw0ppn1cwhco6yn09f7.htm#:~:text=By%20default%2C%20MySQL%20encloses%20column,not%20truncate%20a%20longer%20name.
    const m = v.match(/[./\\]/g)
    if (m) {
      return `Following characters are not allowed ${m.map((c) => JSON.stringify(c)).join(', ')}`
    }

    return true
  }
}

export function validateColumnName(v: string, isGQL = false) {
  if (!v) {
    return 'Column name required'
  }

  // GraphQL naming convention
  // http://spec.graphql.org/June2018/#Name
  if (isGQL) {
    if (/^[_A-Za-z][_0-9A-Za-z]*$/.test(v)) {
      return true
    }

    if (/^[^_A-Za-z]/.test(v)) {
      return 'Name should start with an alphabet or _'
    }
    const m = v.match(/[^_A-Za-z\d]/g)
    if (m) {
      return `Following characters are not allowed ${m.map((c) => JSON.stringify(c)).join(', ')}`
    }
  } else {
    // exclude . / \
    // rest all characters allowed
    // https://documentation.sas.com/doc/en/pgmsascdc/9.4_3.5/acreldb/n0rfg6x1shw0ppn1cwhco6yn09f7.htm#:~:text=By%20default%2C%20MySQL%20encloses%20column,not%20truncate%20a%20longer%20name.
    const m = v.match(/[./\\]/g)
    if (m) {
      return `Following characters are not allowed ${m.map((c) => JSON.stringify(c)).join(', ')}`
    }

    return true
  }
}

export const projectTitleValidator = {
  validator: (rule: any, value: any, callback: (errMsg?: string) => void) => {
    if (value?.length > 50) {
      callback('Project name exceeds 50 characters')
    }
    if (value[0] === ' ') {
      callback('Project name cannot start with space')
    }

    callback()
  },
}
export const fieldRequiredValidator = {
  required: true,
  message: 'Field is required',
}

export const importUrlValidator = {
  validator: (rule: any, value: any, callback: (errMsg?: string) => void) => {
    if (
      /(10)(\.([2]([0-5][0-5]|[01234][6-9])|[1][0-9][0-9]|[1-9][0-9]|[0-9])){3}|(172)\.(1[6-9]|2[0-9]|3[0-1])(\.(2[0-4][0-9]|25[0-5]|[1][0-9][0-9]|[1-9][0-9]|[0-9])){2}|(192)\.(168)(\.(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])){2}|(0.0.0.0)|localhost?/g.test(
        value,
      )
    ) {
      callback('IP Not allowed!')
    }
    callback()
  },
}
