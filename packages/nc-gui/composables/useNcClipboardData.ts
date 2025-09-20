import { useStorage } from '@vueuse/core'
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

  const getCurrentCopiedCellClipboardData = (): NcClipboardDataItemType | null => {
    if (
      !cellClipboardData.value ||
      !currentCellClipboardDataId.value ||
      ncIsObject(cellClipboardData.value) ||
      !cellClipboardData.value[currentCellClipboardDataId.value]
    ) {
      return null
    }

    return cellClipboardData.value[currentCellClipboardDataId.value]
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
  }
}

export default useNcClipboardData
