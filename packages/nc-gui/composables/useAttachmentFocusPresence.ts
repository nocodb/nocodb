import type { ColumnType, TableType } from 'nocodb-sdk'
import type { Row } from '~/lib/types'

export interface AttachmentFocusPresenceParams {
  meta: Ref<TableType | undefined>
  column: Ref<ColumnType | undefined>
  row: Ref<Row | undefined>
  isUploading: Ref<boolean>
}

/** CE no-op — upload presence is an EE feature. */
export function useAttachmentFocusPresence(_params: AttachmentFocusPresenceParams): void {}
