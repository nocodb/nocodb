import { useStorage } from '@vueuse/core'
import type { SerializerOrParserFnProps } from 'nocodb-sdk'
import { extractProps } from 'nocodb-sdk'

/**
 * - ncCurrentClipboardDataId: current copied clipboard data id
 * - ncWaitingClipboardDataId: paste operation in progress clipboard data ids
 */
export enum NcClipboardDataKey {
  ncClipboardData = 'ncClipboardData',
  ncCurrentClipboardDataId = 'ncCurrentClipboardDataId',
  ncWaitingClipboardDataIds = 'ncWaitingClipboardDataIds',
}

const useNcClipboardData = () => {
  const cellClipboardData = useStorage<NcClipboardDataType>(NcClipboardDataKey.ncClipboardData, {})

  const currentCellClipboardDataId = useStorage<string>(NcClipboardDataKey.ncCurrentClipboardDataId, '')

  const waitingCellClipboardDataIds = useStorage<string[]>(NcClipboardDataKey.ncWaitingClipboardDataIds, [])

  const getCurrentCopiedCellClipboardData = (clipboardData: string): NcClipboardDataItemType | null => {
    if (!currentCellClipboardDataId.value || !cellClipboardData.value?.[currentCellClipboardDataId.value]) {
      return null
    }

    const currentClipboardDataItem = cellClipboardData.value?.[currentCellClipboardDataId.value] as NcClipboardDataItemType

    return currentClipboardDataItem?.copiedPlainText === clipboardData && currentClipboardDataItem.dbCellValueArr.length
      ? currentClipboardDataItem
      : null
  }

  const getClipboardItemId = (): string => {
    let id: string

    do {
      id = generateRandomUUID()
    } while (cellClipboardData.value[id])

    return id
  }

  const setCellClipboardDataItem = (item: NcClipboardDataItemType) => {
    /**
     * Keep only the waiting cell clipboard data ids and the new item
     */
    cellClipboardData.value = {
      ...extractProps(cellClipboardData.value, waitingCellClipboardDataIds.value),
      [item.id]: item,
    } as NcClipboardDataType

    currentCellClipboardDataId.value = item.id

    return item
  }

  const extractCellClipboardData = (
    storedClipboardData: NcClipboardDataItemType | null,
    rowIndex: number,
    columnIndex: number,
  ): SerializerOrParserFnProps['params']['clipboardItem'] | undefined => {
    if (!storedClipboardData || !storedClipboardData.columns?.[columnIndex]) return

    return {
      dbCellValue: storedClipboardData.dbCellValueArr?.[rowIndex]?.[columnIndex],
      column: storedClipboardData.columns?.[columnIndex],
      rowId: storedClipboardData.rowIds?.[rowIndex],
    }
  }

  const resetCellClipboard = () => {
    cellClipboardData.value = {}
    currentCellClipboardDataId.value = ''
    waitingCellClipboardDataIds.value = []
  }

  return {
    cellClipboardData,
    currentCellClipboardDataId,
    waitingCellClipboardDataIds,
    getCurrentCopiedCellClipboardData,
    setCellClipboardDataItem,
    resetCellClipboard,
    getClipboardItemId,
    extractCellClipboardData,
  }
}

export default useNcClipboardData
