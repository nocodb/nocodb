import type { AttachmentType, ColumnType } from 'nocodb-sdk'
import { ColumnHelper, UITypes, populateUniqueFileName } from 'nocodb-sdk'

import type { AppInfo } from '~/composables/useGlobal/types'

export default function convertCellData(
  args: {
    to: UITypes
    value: string
    column: ColumnType
    appInfo: AppInfo
    files?: FileList | File[]
    oldValue?: unknown
  },
  isMysql = false,
  isMultiple = false,
) {
  const { to, value, column, files = [], oldValue } = args

  // return null if value is empty
  if (value === '' && to !== UITypes.Attachment) return null

  let serializedValue = value

  /* eslint-disable no-useless-catch */
  try {
    /**
     * This method can throw errors. so it's important to use a try-catch block when calling it.
     */
    serializedValue = ColumnHelper.serializeValue(value, {
      col: column,
      isMysql: (_sourceId) => isMysql,
      isMultipleCellPaste: isMultiple,
    })

    serializedValue = handlePostSerialize(serializedValue, value)
  } catch (ex) {
    throw ex
  }
  /* eslint-enable no-useless-catch */

  function handlePostSerialize(serializedValue: any, value: any) {
    switch (to) {
      case UITypes.Attachment: {
        const parsedOldValue = parseProp(oldValue)
        const oldAttachments = parsedOldValue && Array.isArray(parsedOldValue) ? parsedOldValue : []

        if (!value && !files.length) {
          if (oldAttachments.length) return undefined
          return null
        }

        let parsedVal: Array<Record<string, any>> = []

        if (value) {
          if (!serializedValue) return null

          parsedVal = serializedValue
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

        const attachments: Record<string, any>[] = []

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
              message.error(
                `The size of ${attachment.name} exceeds the maximum file size ${attachmentMeta.maxAttachmentSize} MB.`,
              )
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

        // Todo: on paste file add it don't replace
        if (oldAttachments.length && !attachments.length) {
          return undefined
        } else if (value && attachments.length) {
          const newAttachments: AttachmentType[] = []

          for (const att of attachments) {
            if (!ncIsObject(att)) continue

            newAttachments.push({
              ...att,
              title: populateUniqueFileName(
                att.title,
                oldAttachments.concat(newAttachments).map((fn) => fn?.title || fn?.fileName),
                att.mimetype,
              ),
            })
          }
          return JSON.stringify(oldAttachments.concat(newAttachments))
        } else if (files.length && attachments.length) {
          return attachments
        } else {
          return null
        }
      }
      default: {
        return serializedValue
      }
    }
  }

  return serializedValue
}
