import dayjs from 'dayjs'
import type { ColumnType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import type { AppInfo } from '~/composables/useGlobal'
import { parseProp } from '#imports'

export default function convertCellData(
  args: { from: UITypes; to: UITypes; value: any; column: ColumnType; appInfo: AppInfo },
  isMysql = false,
  isSqlite = false,
  isMssql = false,
  isXcdbBase = false,
) {
  const { from, to, value } = args
  if (from === to && ![UITypes.Attachment, UITypes.Date, UITypes.DateTime, UITypes.Time, UITypes.Year].includes(to)) {
    return value
  }

  const dateFormat = isMysql ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ'

  switch (to) {
    case UITypes.Number: {
      const parsedNumber = Number(value)
      if (isNaN(parsedNumber)) {
        throw new TypeError(`Cannot convert '${value}' to number`)
      }
      return parsedNumber
    }
    case UITypes.Rating: {
      const parsedNumber = Number(value ?? 0)
      if (isNaN(parsedNumber)) {
        throw new TypeError(`Cannot convert '${value}' to rating`)
      }
      return parsedNumber
    }
    case UITypes.Checkbox:
      return Boolean(value)
    case UITypes.Date: {
      const parsedDate = dayjs(value)
      if (!parsedDate.isValid()) throw new Error('Not a valid date')
      return parsedDate.format('YYYY-MM-DD')
    }
    case UITypes.DateTime: {
      const parsedDateTime = dayjs(value)
      if (!parsedDateTime.isValid()) {
        throw new Error('Not a valid datetime value')
      }
      if (isXcdbBase) {
        if (isMysql) {
          // UTC + 'Z'
          return `${parsedDateTime.format('YYYY-MM-DD HH:mm:ss')}Z`
        } else if (isMssql) {
          return parsedDateTime.utc().format('YYYY-MM-DD HH:mm:ssZ')
        } else {
          return parsedDateTime.utc(true).format('YYYY-MM-DD HH:mm:ssZ')
        }
      }
      // TODO(timezone): keep ext db as it is
      return parsedDateTime.format(isMysql ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ')
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
        throw new Error('Not a valid time value')
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

      throw new Error('Not a valid year value')
    }
    case UITypes.Attachment: {
      let parsedVal
      try {
        parsedVal = parseProp(value)
        parsedVal = Array.isArray(parsedVal) ? parsedVal : [parsedVal]
      } catch (e) {
        throw new Error('Invalid attachment data')
      }
      if (parsedVal.some((v: any) => v && !(v.url || v.data))) {
        throw new Error('Invalid attachment data')
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
        ...parseProp(args.column?.meta),
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
    case UITypes.LinkToAnotherRecord:
    case UITypes.Lookup:
    case UITypes.Rollup:
    case UITypes.Formula:
    case UITypes.QrCode:
      throw new Error(`Unsupported conversion from ${from} to ${to}`)
    default:
      return value
  }
}
