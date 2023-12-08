import dayjs from 'dayjs'
import type { ColumnType, SelectOptionsType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import type { AppInfo } from '~/composables/useGlobal'
import { parseProp } from '#imports'

export default function convertCellData(
  args: { to: UITypes; value: string; column: ColumnType; appInfo: AppInfo },
  isMysql = false,
  isMultiple = false,
) {
  const { to, value, column } = args

  const dateFormat = isMysql ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ'

  // return null if value is empty
  if (value === '') return null

  switch (to) {
    case UITypes.SingleLineText:
    case UITypes.LongText:
      // This is to remove the quotes added from LongText
      // TODO (refactor): remove this when we have a better way to handle this
      if (value.match(/^".*"$/)) {
        return value.slice(1, -1)
      }
      return value
    case UITypes.Number: {
      const parsedNumber = Number(value)
      if (isNaN(parsedNumber)) {
        if (isMultiple) {
          return null
        } else {
          throw new TypeError(`Cannot convert '${value}' to number`)
        }
      }
      return parsedNumber
    }
    case UITypes.Rating: {
      const parsedNumber = Number(value ?? 0)
      if (isNaN(parsedNumber)) {
        if (isMultiple) {
          return null
        } else {
          throw new TypeError(`Cannot convert '${value}' to rating`)
        }
      }
      return parsedNumber
    }
    case UITypes.Checkbox:
      if (typeof value === 'boolean') return value
      if (typeof value === 'string') {
        const strval = value.trim().toLowerCase()
        if (strval === 'true' || strval === '1') return true
        if (strval === 'false' || strval === '0' || strval === '') return false
      }
      return null
    case UITypes.Date: {
      const parsedDate = dayjs(value)
      if (!parsedDate.isValid()) {
        if (isMultiple) {
          return null
        } else {
          throw new Error('Not a valid date')
        }
      }
      return parsedDate.format('YYYY-MM-DD')
    }
    case UITypes.DateTime: {
      const parsedDateTime = dayjs(value)
      if (!parsedDateTime.isValid()) {
        if (isMultiple) {
          return null
        } else {
          throw new Error('Not a valid datetime value')
        }
      }
      return parsedDateTime.utc().format('YYYY-MM-DD HH:mm:ssZ')
    }
    case UITypes.Time: {
      let parsedTime = dayjs(value)

      if (!parsedTime.isValid()) {
        parsedTime = dayjs(value, 'HH:mm:ss')
      }
      if (!parsedTime.isValid()) {
        parsedTime = dayjs(`1999-01-01 ${value}`)
      }
      if (!parsedTime.isValid()) {
        if (isMultiple) {
          return null
        } else {
          throw new Error('Not a valid time value')
        }
      }
      return parsedTime.format(dateFormat)
    }
    case UITypes.Year: {
      if (/^\d+$/.test(value)) {
        return +value
      }

      const parsedDate = dayjs(value)

      if (parsedDate.isValid()) {
        return parsedDate.format('YYYY')
      }

      if (isMultiple) {
        return null
      } else {
        throw new Error('Not a valid year value')
      }
    }
    case UITypes.Attachment: {
      let parsedVal
      try {
        parsedVal = parseProp(value)
        parsedVal = Array.isArray(parsedVal) ? parsedVal : [parsedVal]
      } catch (e) {
        if (isMultiple) {
          return null
        } else {
          throw new Error('Invalid attachment data')
        }
      }

      if (parsedVal.some((v: any) => v && !(v.url || v.data || v.path))) {
        return null
      }

      // TODO(refactor): duplicate logic in attachment/utils.ts
      const defaultAttachmentMeta = {
        ...(args.appInfo.ee && {
          // Maximum Number of Attachments per cell
          maxNumberOfAttachments: Math.max(1, +args.appInfo.ncMaxAttachmentsAllowed || 50) || 50,
          // Maximum File Size per file
          maxAttachmentSize: Math.max(1, +args.appInfo.ncMaxAttachmentsAllowed || 20) || 20,
          supportedAttachmentMimeTypes: ['*'],
        }),
      }

      const attachmentMeta = {
        ...defaultAttachmentMeta,
        ...parseProp(column?.meta),
      }

      const attachments = []

      for (const attachment of parsedVal) {
        if (args.appInfo.ee) {
          // verify number of files
          if (parsedVal.length > attachmentMeta.maxNumberOfAttachments) {
            message.error(
              `You can only upload at most ${attachmentMeta.maxNumberOfAttachments} file${
                attachmentMeta.maxNumberOfAttachments > 1 ? 's' : ''
              } to this cell.`,
            )
            return
          }

          // verify file size
          if (attachment.size > attachmentMeta.maxAttachmentSize * 1024 * 1024) {
            message.error(`The size of ${attachment.name} exceeds the maximum file size ${attachmentMeta.maxAttachmentSize} MB.`)
            continue
          }

          // verify mime type
          if (
            !attachmentMeta.supportedAttachmentMimeTypes.includes('*') &&
            !attachmentMeta.supportedAttachmentMimeTypes.includes(attachment.type) &&
            !attachmentMeta.supportedAttachmentMimeTypes.includes(attachment.type.split('/')[0])
          ) {
            message.error(`${attachment.name} has the mime type ${attachment.type} which is not allowed in this column.`)
            continue
          }
        }

        attachments.push(attachment)
      }

      return JSON.stringify(attachments)
    }
    case UITypes.SingleSelect:
    case UITypes.MultiSelect: {
      // return null if value is empty
      if (value === '') return null

      const availableOptions = ((column.colOptions as SelectOptionsType)?.options || []).map((o) => o.title)
      const vals = value.split(',')
      const validVals = vals.filter((v) => availableOptions.includes(v))

      // return null if no valid values
      if (validVals.length === 0) return null

      return validVals.join(',')
    }
    case UITypes.LinkToAnotherRecord:
    case UITypes.Lookup:
    case UITypes.Rollup:
    case UITypes.Formula:
    case UITypes.QrCode: {
      if (isMultiple) {
        return undefined
      } else {
        throw new Error(`Unsupported conversion for ${to}`)
      }
    }
    default:
      return value
  }
}
