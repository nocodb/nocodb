import { createSharedComposable } from '@vueuse/core'
import type { SnapshotType } from 'nocodb-sdk'
import { computed, ref } from 'vue'
import dayjs from 'dayjs'

export type SnapshotExtendedType = SnapshotType & {
  isNew?: boolean
  loading?: boolean
  error?: boolean
}

export const useBaseSettings = createSharedComposable(() => {
  const { $api, $poller } = useNuxtApp()

  const baseStore = useBase()
  const { base } = storeToRefs(baseStore)

  const _projectId = inject(ProjectIdInj, undefined)

  const isCreatingSnapshot = ref(false)
  const isRestoringSnapshot = ref(false)

  const baseId = computed(() => _projectId?.value ?? base.value?.id)

  const snapshots = ref<SnapshotExtendedType[]>([] as SnapshotExtendedType[])

  const updateSnapshot = async (snapshot: SnapshotExtendedType) => {
    try {
      snapshot.loading = true
      await $api.snapshot.update(baseId.value, snapshot.id!, {
        title: snapshot.title,
      })
      snapshot.loading = false
    } catch (error) {
      message.error(await extractSdkResponseErrorMsg(error))
      snapshot.loading = false
      console.error(error)
    }
  }

  const deleteSnapshot = async (snapshot: SnapshotExtendedType) => {
    try {
      snapshot.loading = true
      await $api.snapshot.delete(baseId.value, snapshot.id!)
      snapshots.value = snapshots.value.filter((s) => s.id !== snapshot.id)
    } catch (error) {
      message.error(await extractSdkResponseErrorMsg(error))
      snapshot.loading = false
      snapshot.error = true
      console.error(error)
    }
  }

  const listSnapshots = async () => {
    try {
      const response = await $api.snapshot.list(baseId.value)
      snapshots.value = response.map((snapshot) => ({ ...snapshot, isNew: false }))
    } catch (error) {
      message.error(await extractSdkResponseErrorMsg(error))
      console.error(error)
    }
  }

  const isUnsavedSnapshotsPending = computed(() => snapshots.value.some((s) => s.isNew))

  const cancelNewSnapshot = () => {
    snapshots.value = snapshots.value.filter((s) => !s.isNew)
  }

  const createSnapshot = async (snapshot: Partial<SnapshotExtendedType>) => {
    try {
      const response = await $api.snapshot.create(baseId.value, snapshot)
      isCreatingSnapshot.value = true

      console.log(response)

      $poller.subscribe(
        { id: response.id },
        async (data: {
          id: string
          status?: string
          data?: {
            error?: {
              message: string
            }
            message?: string
            result?: any
          }
        }) => {
          if (data.status !== 'close') {
            if (data.status === JobStatus.COMPLETED) {
              // Table metadata recreated successfully
              message.info('Snapshot created successfully')
              await listSnapshots()
              isCreatingSnapshot.value = false
            } else if (status === JobStatus.FAILED) {
              message.error('Failed to create snapshot')
              isCreatingSnapshot.value = false
            }
          }
        },
      )
    } catch (error) {
      message.error(await extractSdkResponseErrorMsg(error))

      snapshot.error = true
      console.error(error)
    }
  }

  const addNewSnapshot = () => {
    snapshots.value = [
      {
        title: dayjs().format('D MMMM YYYY, h:mm A'),
        isNew: true,
      },
      ...snapshots.value,
    ]
  }

  return {
    snapshots,
    createSnapshot,
    listSnapshots,
    updateSnapshot,
    deleteSnapshot,
    isUnsavedSnapshotsPending,
    cancelNewSnapshot,
    addNewSnapshot,
    isCreatingSnapshot,
    isRestoringSnapshot,
  }
})
