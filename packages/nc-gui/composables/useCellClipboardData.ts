import { useStorage } from '@vueuse/core'
import { extractProps } from 'nocodb-sdk'

/**
 * - ncCurrentCellClipboardDataId: current copied cell clipboard data id
 * - ncWaitingCellClipboardDataId: paste operation in progress cell clipboard data ids
 */
export enum NcCellClipboardDataKey {
  ncCellClipboardData = 'ncCellClipboardData',
  ncCurrentCellClipboardDataId = 'ncCurrentCellClipboardDataId',
  ncWaitingCellClipboardDataIds = 'ncWaitingCellClipboardDataIds',
}

const useCellClipboardData = () => {
  const cellClipboardData = useStorage<NcCellClipboardDataType>(NcCellClipboardDataKey.ncCellClipboardData, {})

  const currentCellClipboardDataId = useStorage<string>(NcCellClipboardDataKey.ncCurrentCellClipboardDataId, '')

  const waitingCellClipboardDataIds = useStorage<string[]>(NcCellClipboardDataKey.ncWaitingCellClipboardDataIds, [])

  const getCurrentCopiedCellClipboardData = () => {
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

  const getUniqueId = (): string => {
    let id: string

    do {
      id = generateRandomUUID()
    } while (cellClipboardData.value[id])

    return id
  }

  const setCellClipboardDataItem = (item: NcCellClipboardDataItemType) => {
    const id = getUniqueId()
    item.id = id

    /**
     * Keep only the waiting cell clipboard data ids and the new item
     */
    cellClipboardData.value = {
      ...extractProps(cellClipboardData.value, waitingCellClipboardDataIds.value),
      [id]: item,
    } as NcCellClipboardDataType

    currentCellClipboardDataId.value = id
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
  }
}

export default useCellClipboardData
