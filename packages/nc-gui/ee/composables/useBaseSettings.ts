import { createSharedComposable } from '@vueuse/core'
import type { SnapshotType } from 'nocodb-sdk'
import { computed, ref } from 'vue'
import dayjs from 'dayjs'

export type SnapshotExtendedType = SnapshotType & {
  isNew?: boolean
  loading?: boolean
  error?: boolean
  created_display_name?: string
}

export const useBaseSettings = createSharedComposable(() => {
  const { $api, $poller } = useNuxtApp()

  const baseStore = useBase()
  const { base } = storeToRefs(baseStore)

  const basesStore = useBases()

  const { loadProjects } = basesStore

  const { navigateToProject } = useGlobal()

  const { refreshCommandPalette } = useCommandPalette()

  const _projectId = inject(ProjectIdInj, undefined)

  const isCreatingSnapshot = ref(false)

  const isRestoringSnapshot = ref(false)

  const baseId = computed(() => _projectId?.value ?? base.value?.id)

  const { basesUser, bases } = storeToRefs(basesStore)

  const baseUsers = computed(() => (baseId.value ? basesUser.value.get(baseId.value) || [] : []))

  const snapshots = ref<SnapshotExtendedType[]>([] as SnapshotExtendedType[])

  const newSnapshotTitle = ref('')

  const isSnapshotCreationFailed = ref(false)

  const isCooldownPeriodReached = ref(false)

  const checkIfCooldownPeriodReached = () => {
    const lastSnapshot = [...snapshots.value]
      .filter((s) => !s.isNew)
      .sort((a, b) => dayjs(b.created_at).unix() - dayjs(a.created_at).unix())[0]

    if (!lastSnapshot) {
      isCooldownPeriodReached.value = false
      return
    }

    isCooldownPeriodReached.value = dayjs().diff(dayjs(lastSnapshot.created_at), 'hour') < 3
  }

  const isSnapshotLimitReached = computed(() => snapshots.value.length >= 2)

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
    if (!baseId.value) return
    try {
      await $api.snapshot.delete(baseId.value, snapshot.id!)
      snapshots.value = snapshots.value.filter((s) => s.id !== snapshot.id)

      checkIfCooldownPeriodReached()
    } catch (error) {
      message.error(await extractSdkResponseErrorMsg(error))
      console.error(error)
    }
  }

  const listSnapshots = async () => {
    try {
      const response = await $api.snapshot.list(baseId.value)
      snapshots.value = response.map((snapshot) => {
        const user = baseUsers.value.find((u) => u.id === snapshot.created_by)
        return {
          ...snapshot,
          isNew: false,
          created_display_name: user?.display_name ?? (user?.email ?? '').split('@')[0],
        }
      })
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
    if (!baseId.value) return
    try {
      const response = await $api.snapshot.create(baseId.value, {
        ...snapshot,
        title: newSnapshotTitle.value,
      })
      isCreatingSnapshot.value = true

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
            } else if (data.status === JobStatus.FAILED) {
              message.error('Failed to create snapshot')
              isCreatingSnapshot.value = false
              isSnapshotCreationFailed.value = true
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

  const restoreSnapshot = async (snapshot: SnapshotExtendedType, onRestoreSuccess?: () => void | Promise<void>) => {
    if (!baseId.value) return
    try {
      isRestoringSnapshot.value = true
      const response = await $api.snapshot.restore(baseId.value, snapshot.id!)

      $poller.subscribe(
        { id: response.id! },
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
          if (data.status === JobStatus.COMPLETED) {
            await loadProjects('workspace')

            const base = bases.value.get(data.data?.result.id)

            isRestoringSnapshot.value = false

            // open project after snapshot success
            if (base) {
              await navigateToProject({
                workspaceId: isEeUI ? base.fk_workspace_id : undefined,
                baseId: base.id,
                type: base.type,
              })
            }
            message.info('Snapshot restored successfully')

            onRestoreSuccess?.()

            refreshCommandPalette()
          } else if (data.status === JobStatus.FAILED) {
            message.error('Failed to restore snapshot')
            await loadProjects('workspace')
            isRestoringSnapshot.value = false

            refreshCommandPalette()
          }
        },
      )
    } catch (error) {
      message.error(await extractSdkResponseErrorMsg(error))
      console.error(error)
    }
  }

  const addNewSnapshot = () => {
    checkIfCooldownPeriodReached()
    if (isSnapshotLimitReached.value) {
      message.error('Maximum 2 snapshots allowed per base at a time in the free plan')
      return
    }

    if (isCooldownPeriodReached.value) {
      message.error('Please wait for 3 hours before creating a new snapshot')
      return
    }

    newSnapshotTitle.value = dayjs().format('D MMMM YYYY, h:mm A')
    snapshots.value = [
      {
        title: newSnapshotTitle,
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
    restoreSnapshot,
    newSnapshotTitle,
    isSnapshotLimitReached,
    isCooldownPeriodReached,
    isSnapshotCreationFailed,
  }
})
