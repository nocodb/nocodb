import axios from 'axios'
import type { PaginatedType } from 'nocodb-sdk'

const usePaginationShortcuts = ({
  changePage,
  paginationDataRef,
  isViewDataLoading,
}: {
  changePage: (page: number) => Promise<void> | undefined
  paginationDataRef: Ref<PaginatedType | undefined>
  isViewDataLoading: Ref<boolean>
}) => {
  const getTotalPages = () => {
    return Math.ceil(paginationDataRef.value!.totalRows! / paginationDataRef.value!.pageSize!)
  }

  const changePageWithLoading = async (page: number) => {
    isViewDataLoading.value = true
    try {
      await changePage?.(page)
      isViewDataLoading.value = false
    } catch (e) {
      if (axios.isCancel(e)) return

      isViewDataLoading.value = false
    }
  }

  const onLeft = async (e: KeyboardEvent) => {
    if (isExpandedCellInputExist()) return

    if (!e.altKey) return
    e.preventDefault()

    const page = paginationDataRef.value!.page! - 1
    if (page < 1) return

    await changePageWithLoading(page)
  }

  const onRight = async (e: KeyboardEvent) => {
    if (isExpandedCellInputExist()) return

    if (!e.altKey) return
    e.preventDefault()

    const page = paginationDataRef.value!.page! + 1

    if (page > getTotalPages()) return

    await changePageWithLoading(page)
  }

  const onDown = async (e: KeyboardEvent) => {
    if (isExpandedCellInputExist()) return

    if (!e.altKey) return
    e.preventDefault()

    if (paginationDataRef.value!.page! === getTotalPages()) return

    await changePageWithLoading(getTotalPages())
  }

  const onUp = async (e: KeyboardEvent) => {
    if (isExpandedCellInputExist()) return

    if (!e.altKey) return
    e.preventDefault()

    if (paginationDataRef.value!.page! === 1) return

    await changePageWithLoading(1)
  }

  return {
    onLeft,
    onRight,
    onUp,
    onDown,
  }
}

export default usePaginationShortcuts
