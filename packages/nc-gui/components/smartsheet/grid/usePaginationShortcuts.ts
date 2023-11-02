import axios from 'axios'
import type { PaginatedType } from 'nocodb-sdk'

const usePaginationShortcuts = ({
  changePage,
  paginationDataRef,
}: {
  changePage: (page: number) => Promise<void> | undefined
  paginationDataRef: Ref<PaginatedType | undefined>
}) => {
  const { isViewDataLoading } = storeToRefs(useViewsStore())
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
    if (!e.altKey) return
    e.preventDefault()

    const page = paginationDataRef.value!.page! - 1
    if (page < 1) return

    await changePageWithLoading(page)
  }

  const onRight = async (e: KeyboardEvent) => {
    if (!e.altKey) return
    e.preventDefault()

    const page = paginationDataRef.value!.page! + 1

    if (page > getTotalPages()) return

    await changePageWithLoading(page)
  }

  const onDown = async (e: KeyboardEvent) => {
    if (!e.altKey) return
    e.preventDefault()

    const page = 1

    await changePageWithLoading(page)
  }

  const onUp = async (e: KeyboardEvent) => {
    if (!e.altKey) return
    e.preventDefault()

    await changePageWithLoading(getTotalPages())
  }

  return {
    onLeft,
    onRight,
    onUp,
    onDown,
  }
}

export default usePaginationShortcuts
