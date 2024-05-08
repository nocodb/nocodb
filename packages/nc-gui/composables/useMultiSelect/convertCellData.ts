import dayjs from 'dayjs'
import type { AttachmentType, ColumnType, LinkToAnotherRecordType, SelectOptionsType } from 'nocodb-sdk'
import { UITypes, getDateFormat, getDateTimeFormat, populateUniqueFileName } from 'nocodb-sdk'
import type { AppInfo } from '~/composables/useGlobal/types'
import { extractEmail } from '~/helpers/parsers/parserHelpers'

export default function convertCellData(
  args: { to: UITypes; value: string; column: ColumnType; appInfo: AppInfo; files?: FileList | File[]; oldValue?: unknown },
  isMysql = false,
  isMultiple = false,
) {
  const { to, value, column, files = [], oldValue } = args

  const dateFormat = isMysql ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ'

  // return null if value is empty
  if (value === '' && to !== UITypes.Attachment) return null

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
    case UITypes.Date:
    case UITypes.DateTime: {
      let parsedDateOrDateTime = dayjs(value, getDateTimeFormat(value))

      if (!parsedDateOrDateTime.isValid()) {
        parsedDateOrDateTime = dayjs(value, getDateFormat(value))
      }

      if (!parsedDateOrDateTime.isValid()) {
        if (isMultiple) {
          return null
        } else {
          throw new Error(`Not a valid '${to}' value`)
        }
      }
      return to === UITypes.Date
        ? parsedDateOrDateTime.format('YYYY-MM-DD')
        : parsedDateOrDateTime.utc().format('YYYY-MM-DD HH:mm:ssZ')
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
      const parsedOldValue = parseProp(oldValue)
      const oldAttachments = parsedOldValue && Array.isArray(parsedOldValue) ? parsedOldValue : []

      if (!value && !files.length) {
        if (oldAttachments.length) return undefined
        return null
      }

      let parsedVal = []
      if (value) {
        try {
          parsedVal = parseProp(value)
          parsedVal = Array.isArray(parsedVal)
            ? parsedVal
            : typeof parsedVal === 'object' && Object.keys(parsedVal).length
            ? [parsedVal]
            : []
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
      }

      // TODO(refactor): duplicate logic in attachment/utils.ts
      const defaultAttachmentMeta = {
        ...(args.appInfo.ee && {
          // Maximum Number of Attachments per cell
          maxNumberOfAttachments: Math.max(1, +args.appInfo.ncMaxAttachmentsAllowed || 50) || 50,
          // Maximum File Size per file
          maxAttachmentSize: Math.max(1, +args.appInfo.ncAttachmentFieldSize || 20) || 20,
          supportedAttachmentMimeTypes: ['*'],
        }),
      }

      const attachmentMeta = {
        ...defaultAttachmentMeta,
        ...parseProp(column?.meta),
      }

      const attachments = []

      for (const attachment of value ? parsedVal : files) {
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

      if (oldAttachments.length && !attachments.length) {
        return undefined
      } else if (value && attachments.length) {
        const newAttachments: AttachmentType[] = []

        for (const att of attachments) {
          newAttachments.push({
            ...att,
            title: populateUniqueFileName(
              att?.title,
              [...oldAttachments, ...newAttachments].map((fn) => fn?.title || fn?.fileName),
              att?.mimetype,
            ),
          })
        }
        return JSON.stringify([...oldAttachments, ...newAttachments])
      } else if (files.length && attachments.length) {
        return attachments
      } else {
        return null
      }
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
    case UITypes.User:
    case UITypes.CreatedBy:
    case UITypes.LastModifiedBy: {
      let parsedVal
      try {
        try {
          parsedVal = typeof value === 'string' ? JSON.parse(value) : value
        } catch {
          parsedVal = value
        }
      } catch (e) {
        if (isMultiple) {
          return null
        } else {
          throw new Error('Invalid user data')
        }
      }

      return parsedVal || value
    }
    case UITypes.LinkToAnotherRecord: {
      if (isMultiple) {
        return undefined
      }

      if (isBt(column) || isOo(column)) {
        const parsedVal = typeof value === 'string' ? JSON.parse(value) : value

        if (
          !(parsedVal && typeof parsedVal === 'object' && !Array.isArray(parsedVal) && Object.keys(parsedVal)) ||
          parsedVal?.fk_related_model_id !== (column.colOptions as LinkToAnotherRecordType)?.fk_related_model_id
        ) {
          throw new Error(`Unsupported conversion for ${to}`)
        }

        return parsedVal
      } else {
        throw new Error(`Unsupported conversion for ${to}`)
      }
    }
    case UITypes.Links: {
      if (isMultiple) {
        return undefined
      }

      if (isMm(column)) {
        const parsedVal = typeof value === 'string' ? JSON.parse(value) : value

        if (
          !(
            parsedVal &&
            typeof parsedVal === 'object' &&
            !Array.isArray(parsedVal) &&
            // eslint-disable-next-line no-prototype-builtins
            ['rowId', 'columnId', 'fk_related_model_id', 'value'].every((key) => (parsedVal as Object).hasOwnProperty(key))
          ) ||
          parsedVal?.fk_related_model_id !== (column.colOptions as LinkToAnotherRecordType).fk_related_model_id
        ) {
          throw new Error(`Unsupported conversion for ${to}`)
        }

        return parsedVal
      } else {
        throw new Error(`Unsupported conversion for ${to}`)
      }
    }
    case UITypes.Email: {
      if (parseProp(column.meta).validate) {
        return extractEmail(value) || value
      }
      return value
    }
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
