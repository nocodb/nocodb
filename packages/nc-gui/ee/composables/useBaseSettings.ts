import { type PlanLimitExceededDetailsType, PlanLimitTypes, type SnapshotType, type WorkspaceType } from 'nocodb-sdk'
import dayjs from 'dayjs'

export type SnapshotExtendedType = SnapshotType & {
  isNew?: boolean
  loading?: boolean
  error?: boolean
  created_display_name?: string
}

export const useBaseSettings = createSharedComposable(() => {
  const { $api, $poller } = useNuxtApp()

  const { t } = useI18n()

  const basesStore = useBases()

  const { activeProjectId } = storeToRefs(basesStore)

  const { loadProjects } = basesStore

  const { navigateToProject } = useGlobal()

  const { refreshCommandPalette } = useCommandPalette()

  const {
    getLimit,
    handleUpgradePlan,
    getPlanTitle,
    getHigherPlan,
    getStatLimit,
    activePlan,
    isPaymentEnabled,
    updateStatLimit,
  } = useEeConfig()

  const isCreatingSnapshot = ref(false)

  const isRestoringSnapshot = ref(false)

  const { basesUser } = storeToRefs(basesStore)

  const baseUsers = computed(() => (activeProjectId.value ? basesUser.value.get(activeProjectId.value) || [] : []))

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

  const updateSnapshot = async (snapshot: SnapshotExtendedType) => {
    try {
      snapshot.loading = true

      // trim title before saving
      if (snapshot.title) {
        snapshot.title = snapshot.title.trim()
      }

      await $api.snapshot.update(activeProjectId.value, snapshot.id!, {
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
    if (!activeProjectId.value) return
    try {
      await $api.snapshot.delete(activeProjectId.value, snapshot.id!)
      snapshots.value = snapshots.value.filter((s) => s.id !== snapshot.id)

      checkIfCooldownPeriodReached()

      updateStatLimit(PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE, -1)
    } catch (error) {
      message.error(await extractSdkResponseErrorMsg(error))
      console.error(error)
    }
  }

  const listSnapshots = async () => {
    try {
      const response = await $api.snapshot.list(activeProjectId.value)
      snapshots.value = response.map((snapshot) => {
        const user = baseUsers.value.find((u) => u.id === snapshot.created_by)
        return {
          ...snapshot,
          isNew: false,
          created_display_name: user?.display_name ?? user?.email ?? '',
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
    if (!activeProjectId.value) return
    try {
      const response = await $api.snapshot.create(activeProjectId.value, {
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
              updateStatLimit(PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE, 1)
            } else if (data.status === JobStatus.FAILED) {
              message.error(data.data?.error?.message || 'Failed to create snapshot')
              isCreatingSnapshot.value = false
              isSnapshotCreationFailed.value = true
            }
          }
        },
      )
    } catch (error: any) {
      const errorInfo = await extractSdkResponseErrorMsgv2(error)

      if (isPaymentEnabled.value && errorInfo.error === NcErrorType.PLAN_LIMIT_EXCEEDED) {
        const details = errorInfo.details as PlanLimitExceededDetailsType

        return handleUpgradePlan({
          title: details.limit === 0 ? t('upgrade.UpgradeToCreateSnapshots') : t('upgrade.UpgradeToCreateAdditionalSnapshots'),
          content:
            details.limit === 0
              ? t('upgrade.UpgradeToCreateSnapshotsSubtitle', {
                  activePlan: details.plan,
                  plan: details.higherPlan,
                })
              : t('upgrade.UpgradeToCreateAdditionalSnapshotsSubtitle', {
                  n: details.current,
                  activePlan: details.plan,
                  plan: details.higherPlan,
                }),
          limitOrFeature: PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE,
        })
      } else {
        message.error(errorInfo.message)

        snapshot.error = true
        console.error(error)
      }
    }
  }

  const restoreSnapshot = async (
    snapshot: SnapshotExtendedType,
    workspace?: WorkspaceType,
    onRestoreSuccess?: () => void | Promise<void>,
  ) => {
    if (!activeProjectId.value) return
    try {
      isRestoringSnapshot.value = true
      const response = await $api.snapshot.restore(activeProjectId.value, snapshot.id!, { workspaceId: workspace?.id ?? '' })

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
            const tBases = await loadProjects('workspace', workspace?.id)

            const base = tBases?.find((b) => b.id === data.data?.result.id)

            isRestoringSnapshot.value = false

            // open project after snapshot success
            if (base) {
              navigateToProject({
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
      isRestoringSnapshot.value = false
      message.error(await extractSdkResponseErrorMsg(error))
      console.error(error)
    }
  }

  const verifySnapshotLimit = () => {
    if (!isPaymentEnabled.value) return false

    // If snapshot count is greater than or equal to limit then show upgrade modal
    if (getStatLimit(PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE) >= getLimit(PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE)) {
      return true
    }

    return false
  }

  const addNewSnapshot = () => {
    if (verifySnapshotLimit()) {
      const limit = getLimit(PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE)
      return handleUpgradePlan({
        title: limit === 0 ? t('upgrade.UpgradeToCreateSnapshots') : t('upgrade.UpgradeToCreateAdditionalSnapshots'),
        content:
          limit === 0
            ? t('upgrade.UpgradeToCreateSnapshotsSubtitle', {
                activePlan: getPlanTitle(activePlan.value?.title),
                plan: getHigherPlan(),
              })
            : t('upgrade.UpgradeToCreateAdditionalSnapshotsSubtitle', {
                n: getLimit(PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE),
                activePlan: getPlanTitle(activePlan.value?.title),
                plan: getHigherPlan(),
              }),
        limitOrFeature: PlanLimitTypes.LIMIT_SNAPSHOT_PER_WORKSPACE,
      })
    }

    checkIfCooldownPeriodReached()

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
    isCooldownPeriodReached,
    isSnapshotCreationFailed,
  }
})
