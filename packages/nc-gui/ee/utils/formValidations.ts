import type { RuleObject } from 'ant-design-vue/es/form'
import { isCompanyEmail } from 'company-email-validator'
import dayjs from 'dayjs'
import type { ColumnType, Validation } from 'nocodb-sdk'
import {
  AttachmentValidationType,
  DateValidationType,
  NumberValidationType,
  SelectValidationType,
  StringValidationType,
  TimeValidationType,
  UITypes,
  YearValidationType,
} from 'nocodb-sdk'
import {
  formEmailValidator,
  formNumberInputValidator,
  formPhoneNumberValidator,
  formUrlValidator,
  isEmptyValidatorValue,
} from '../../utils/formValidations'

export const formBusinessEmailValidator = (val: Validation) => {
  return {
    validator: (_rule: RuleObject, value: any) => {
      return new Promise((resolve, reject) => {
        if (value && !isCompanyEmail(value)) {
          return reject(val.message || `Invalid work email`)
        }
        return resolve(true)
      })
    },
  }
}
export const maxLengthValidator = (val: Validation) => {
  return {
    validator: (_rule: RuleObject, value: any) => {
      return new Promise((resolve, reject) => {
        if (value) {
          if (value.length > val.value) {
            return reject(val.message || `The input must not exceed ${val.value} characters.`)
          } else {
            return resolve(true)
          }
        }
        return resolve(true)
      })
    },
  }
}

export const minLengthValidator = (val: Validation) => {
  return {
    validator: (_rule: RuleObject, value: any) => {
      return new Promise((resolve, reject) => {
        if (value) {
          if (val.value > 0 && value.length < val.value) {
            return reject(val.message || `The input must be at least ${val.value} characters long.`)
          } else {
            return resolve(true)
          }
        }
        return resolve(true)
      })
    },
  }
}

export const startsWithValidator = (val: Validation) => {
  return {
    validator: (_rule: RuleObject, value: any) => {
      return new Promise((resolve, reject) => {
        if (value) {
          if (!value.startsWith(val.value)) {
            return reject(val.message || `The input must start with '${val.value}'.`)
          } else {
            return resolve(true)
          }
        }
        return resolve(true)
      })
    },
  }
}

export const endsWithValidator = (val: Validation) => {
  return {
    validator: (_rule: RuleObject, value: any) => {
      return new Promise((resolve, reject) => {
        if (value) {
          if (!value.endsWith(val.value)) {
            return reject(val.message || `The input must end with '${val.value}'.`)
          } else {
            return resolve(true)
          }
        }
        return resolve(true)
      })
    },
  }
}

export const includesValidator = (val: Validation) => {
  return {
    validator: (_rule: RuleObject, value: any) => {
      return new Promise((resolve, reject) => {
        if (value) {
          if (!value.includes(val.value)) {
            return reject(val.message || `The input must contain the string '${val.value}'.`)
          } else {
            return resolve(true)
          }
        }
        return resolve(true)
      })
    },
  }
}

export const notIncludesValidator = (val: Validation) => {
  return {
    validator: (_rule: RuleObject, value: any) => {
      return new Promise((resolve, reject) => {
        if (value) {
          if (value.includes(val.value)) {
            return reject(val.message || `The input must not contain the string '${val.value}'.`)
          } else {
            return resolve(true)
          }
        }
        return resolve(true)
      })
    },
  }
}

export const regexValidator = (val: Validation) => {
  return {
    validator: (_rule: RuleObject, value: any) => {
      return new Promise((resolve, reject) => {
        if (value) {
          const regex = new RegExp(val.regex)

          if (!regex.test(value)) {
            return reject(val.message || `The input does not match the required format.`)
          } else {
            return resolve(true)
          }
        }
        return resolve(true)
      })
    },
  }
}

export const maxNumberValidator = (val: Validation, col: ColumnType) => {
  return {
    validator: (_rule: RuleObject, value: any) => {
      return new Promise((resolve, reject) => {
        if (value !== null) {
          if (value > val.value) {
            return reject(val.message || getDefaultMessage(getFormattedValue(val.value, col), col, val))
          } else {
            return resolve(true)
          }
        }
        return resolve(true)
      })
    },
  }
}

export const minNumberValidator = (val: Validation, col: ColumnType) => {
  return {
    validator: (_rule: RuleObject, value: any) => {
      return new Promise((resolve, reject) => {
        if (value !== null) {
          if (value < val.value) {
            return reject(val.message || getDefaultMessage(getFormattedValue(val.value, col), col, val))
          } else {
            return resolve(true)
          }
        }
        return resolve(true)
      })
    },
  }
}

export const maxSelectValidator = (val: Validation, col: ColumnType) => {
  return {
    validator: (_rule: RuleObject, value: any) => {
      return new Promise((resolve, reject) => {
        if (value) {
          if (
            isLink(col) ? (Array.isArray(value) ? value.length > val.value : false) : String(value).split(',').length > val.value
          ) {
            return reject(val.message || getDefaultMessage(getFormattedValue(val.value, col), col, val))
          } else {
            return resolve(true)
          }
        }
        return resolve(true)
      })
    },
  }
}

export const minSelectValidator = (val: Validation, col: ColumnType) => {
  return {
    validator: (_rule: RuleObject, value: any) => {
      return new Promise((resolve, reject) => {
        if (value) {
          if (
            isLink(col) ? (Array.isArray(value) ? value.length < val.value : false) : String(value).split(',').length < val.value
          ) {
            return reject(val.message || getDefaultMessage(getFormattedValue(val.value, col), col, val))
          } else {
            return resolve(true)
          }
        }
        return resolve(true)
      })
    },
  }
}
export const maxDateValidator = (val: Validation, col: ColumnType) => {
  return {
    validator: (_rule: RuleObject, value: any) => {
      return new Promise((resolve, reject) => {
        if (value) {
          const currentValue = dayjs(col.uidt === UITypes.Date ? value : dayjs(value).utc().local().format('YYYY-MM-DD'))

          const storedValue = dayjs(val.value)

          if (currentValue.isAfter(storedValue)) {
            return reject(val.message || getDefaultMessage(getFormattedValue(val.value, col), col, val))
          } else {
            return resolve(true)
          }
        }
        return resolve(true)
      })
    },
  }
}

export const minDateValidator = (val: Validation, col: ColumnType) => {
  return {
    validator: (_rule: RuleObject, value: any) => {
      return new Promise((resolve, reject) => {
        if (value) {
          const currentValue = dayjs(col.uidt === UITypes.Date ? value : dayjs(value).utc().local().format('YYYY-MM-DD'))

          const storedValue = dayjs(val.value)

          if (currentValue.isBefore(storedValue)) {
            return reject(val.message || getDefaultMessage(getFormattedValue(val.value, col), col, val))
          } else {
            return resolve(true)
          }
        }
        return resolve(true)
      })
    },
  }
}
export const maxTimeValidator = (val: Validation, col: ColumnType) => {
  return {
    validator: (_rule: RuleObject, value: any) => {
      return new Promise((resolve, reject) => {
        if (value) {
          const currentValue = dayjs(`1999-01-01 ${dayjs(value).isValid() ? dayjs(value).format('HH:mm:ss') : `${value}:00`}`)

          const storedValue = dayjs(`1999-01-01 ${dayjs(val.value).format('HH:mm:ss')}`)

          if (currentValue.isAfter(storedValue)) {
            return reject(val.message || getDefaultMessage(getFormattedValue(val.value, col), col, val))
          } else {
            return resolve(true)
          }
        }
        return resolve(true)
      })
    },
  }
}

export const minTimeValidator = (val: Validation, col: ColumnType) => {
  return {
    validator: (_rule: RuleObject, value: any) => {
      return new Promise((resolve, reject) => {
        if (value) {
          const currentValue = dayjs(`1999-01-01 ${dayjs(value).isValid() ? dayjs(value).format('HH:mm:ss') : `${value}:00`}`)

          const storedValue = dayjs(`1999-01-01 ${dayjs(val.value).format('HH:mm:ss')}`)

          if (currentValue.isBefore(storedValue)) {
            return reject(val.message || getDefaultMessage(getFormattedValue(val.value, col), col, val))
          } else {
            return resolve(true)
          }
        }
        return resolve(true)
      })
    },
  }
}

// Todo: check for supported file types/mime type
export const attachmentFileTypesValidator = (val: Validation) => {
  return {
    validator: (_rule: RuleObject, value: any) => {
      return new Promise((resolve, reject) => {
        if (value && val.value?.length) {
          // Function to match MIME type against wildcard pattern
          function matchMimeType(mimeType, pattern) {
            const [type, subtype] = pattern.split('/')
            return type === mimeType.split('/')[0] && (subtype === '*' || subtype === mimeType.split('/')[1])
          }

          const invalidFiles = (typeof value === 'string' ? JSON.parse(value) ?? [] : value)?.reduce((acc, file) => {
            // Check if the file's MIME type matches any of the wildcard patterns
            if ((val.value || []).some((pattern) => matchMimeType(file.mimetype, pattern))) {
              return acc // The file matches one of the wildcard patterns, so continue to the next file
            }

            // Check if the file's MIME type is included in the array of allowed MIME types
            if (!(val.value || []).includes(file.mimetype)) {
              acc.push(file.mimetype)
            }

            return acc
          }, [])
          if (invalidFiles.length) {
            return reject(val.message || `Only following file types allowed to upload '${(val.value || []).join(', ')}'`)
          } else {
            return resolve(true)
          }
        }

        return resolve(true)
      })
    },
  }
}

export const attachmentFileCountValidator = (val: Validation) => {
  return {
    validator: (_rule: RuleObject, value: any) => {
      return new Promise((resolve, reject) => {
        if (value && val.value > 0 && (typeof value === 'string' ? JSON.parse(value) ?? [] : value)?.length > val.value) {
          return reject(val.message || `The file count must not exceed ${val.value}`)
        }
        return resolve(true)
      })
    },
  }
}

export const attachmentFileSizeValidator = (val: Validation, col: ColumnType) => {
  return {
    validator: (_rule: RuleObject, value: any) => {
      return new Promise((resolve, reject) => {
        if (value) {
          const invalidFiles = (typeof value === 'string' ? JSON.parse(value) ?? [] : value)
            ?.reduce((acc, file) => {
              const fileSize = file?.size ?? file?.file?.size

              if (fileSize && fileSize / 1024 > val.value) {
                acc.push(file?.title)
              }
              return acc
            }, [])
            .filter((f) => f)

          if (invalidFiles.length) {
            return reject(
              val.message ||
                `The file size must not exceed ${getFormattedValue(val.value, col, val)} (${invalidFiles.join(', ')})`,
            )
          }
        }
        return resolve(true)
      })
    },
  }
}

function getDefaultMessage(value: any, col: ColumnType, val?: Validation) {
  switch (col.uidt) {
    case UITypes.Duration: {
      return val?.type === NumberValidationType.Min
        ? `Input a duration equal to or later than ${value}`
        : `Input a duration equal to or earlier than ${value}`
    }
    case UITypes.Date:
    case UITypes.DateTime: {
      return val?.type === DateValidationType.MinDate
        ? `Select a date on or after ${value}`
        : `Select a date on or before ${value}`
    }

    case UITypes.Time: {
      return val?.type === TimeValidationType.MinTime
        ? `Input a time equal to or later than ${value}`
        : `Input a time equal to or earlier than ${value}`
    }
    case UITypes.Year: {
      return val?.type === YearValidationType.MinYear
        ? `Input a year equal to or later than ${value}`
        : `Input a year equal to or earlier than ${value}`
    }

    case UITypes.Number:
    case UITypes.Decimal:
    case UITypes.Percent:
    case UITypes.Currency: {
      return val?.type === NumberValidationType.Min
        ? `Input a number equal to or greater than ${value}`
        : `Input a number equal to or less than ${value}`
    }

    case UITypes.MultiSelect:
    case UITypes.User: {
      return val?.type === SelectValidationType.MinSelected
        ? `Please select at least ${value} option${value !== 1 ? 's' : ''}`
        : `Please select at most ${value} option${value !== 1 ? 's' : ''}`
    }

    case UITypes.Links: {
      return val?.type === NumberValidationType.Min
        ? `Please select at least ${value} record${value !== 1 ? 's' : ''}`
        : `Please select at most ${value} record${value !== 1 ? 's' : ''}`
    }
  }

  return value
}

function getFormattedValue(value: any, col: ColumnType, val?: Validation) {
  switch (col.uidt) {
    case UITypes.Duration: {
      return convertMS2Duration(value, parseProp(col.meta)?.duration || 0)
    }
    case UITypes.Date:
    case UITypes.DateTime: {
      return dayjs(value)
        .utc()
        .local()
        .format(parseProp(col?.meta)?.date_format ?? 'YYYY-MM-DD')
    }

    case UITypes.Time: {
      return dayjs(value).format('HH:mm')
    }
    case UITypes.Attachment: {
      if (val?.type === AttachmentValidationType.FileSize) {
        if (val?.unit === 'MB') {
          return `${value / 1024} MB`
        } else {
          return `${value} KB`
        }
      }
      return value
    }
  }
  return value
}

export const extractFieldValidator = (validators: Validation[], element: ColumnType) => {
  const rules: RuleObject[] = []

  // Add column default validators if not present in validators array
  if ([UITypes.Number, UITypes.Currency, UITypes.Percent].includes(element.uidt)) {
    rules.push(formNumberInputValidator(element))
  }

  switch (element.uidt) {
    case UITypes.Email: {
      if (parseProp(element.meta).validate && !validators.find((val) => val.type === StringValidationType.Email)) {
        rules.push(
          formEmailValidator({
            type: StringValidationType.Email,
          }),
        )
      }
      break
    }
    case UITypes.PhoneNumber: {
      if (parseProp(element.meta).validate && !validators.find((val) => val.type === StringValidationType.PhoneNumber)) {
        rules.push(
          formPhoneNumberValidator({
            type: StringValidationType.PhoneNumber,
          }),
        )
      }
      break
    }
    case UITypes.URL: {
      if (parseProp(element.meta).validate && !validators.find((val) => val.type === StringValidationType.Url)) {
        rules.push(
          formUrlValidator({
            type: StringValidationType.Url,
          }),
        )
      }
      break
    }
  }

  validators
    .filter((v) => {
      if (v.type && !isEmptyValidatorValue(v)) {
        return true
      }

      return false
    })
    .forEach((val) => {
      switch (val.type) {
        // Email, Phone, Url validator
        case StringValidationType.Email: {
          rules.push(formEmailValidator(val))
          break
        }
        case StringValidationType.BusinessEmail: {
          // Add business email validator only if email validator is enabled
          if (parseProp(element.meta).validate || validators.find((val) => val.type === StringValidationType.Email)) {
            rules.push(formBusinessEmailValidator(val))
          }
          break
        }
        case StringValidationType.PhoneNumber: {
          rules.push(formPhoneNumberValidator(val))
          break
        }
        case StringValidationType.Url: {
          rules.push(formUrlValidator(val))
          break
        }

        // StringValidationType
        case StringValidationType.MaxLength: {
          rules.push(maxLengthValidator(val))
          break
        }
        case StringValidationType.MinLength: {
          rules.push(minLengthValidator(val))
          break
        }
        case StringValidationType.StartsWith: {
          rules.push(startsWithValidator(val))
          break
        }
        case StringValidationType.EndsWith: {
          rules.push(endsWithValidator(val))
          break
        }
        case StringValidationType.Includes: {
          rules.push(includesValidator(val))
          break
        }
        case StringValidationType.NotIncludes: {
          rules.push(notIncludesValidator(val))
          break
        }
        case StringValidationType.Regex: {
          rules.push(regexValidator(val))
          break
        }

        // NumberValidationType
        case YearValidationType.MaxYear:
        case NumberValidationType.Max: {
          rules.push(maxNumberValidator(val, element))
          break
        }
        case YearValidationType.MinYear:
        case NumberValidationType.Min: {
          rules.push(minNumberValidator(val, element))
          break
        }

        // SelectValidationType
        case SelectValidationType.MaxSelected: {
          rules.push(maxSelectValidator(val, element))
          break
        }
        case SelectValidationType.MinSelected: {
          rules.push(minSelectValidator(val, element))
          break
        }

        // DateValidationType
        case DateValidationType.MaxDate: {
          rules.push(maxDateValidator(val, element))
          break
        }
        case DateValidationType.MinDate: {
          rules.push(minDateValidator(val, element))
          break
        }

        // TimeValidationType
        case TimeValidationType.MaxTime: {
          rules.push(maxTimeValidator(val, element))
          break
        }
        case TimeValidationType.MinTime: {
          rules.push(minTimeValidator(val, element))
          break
        }

        // AttachmentValidationType
        case AttachmentValidationType.FileTypes: {
          rules.push(attachmentFileTypesValidator(val, element))
          break
        }
        case AttachmentValidationType.FileCount: {
          rules.push(attachmentFileCountValidator(val, element))
          break
        }
        case AttachmentValidationType.FileSize: {
          rules.push(attachmentFileSizeValidator(val, element))
          break
        }
      }
    })

  return rules
}
