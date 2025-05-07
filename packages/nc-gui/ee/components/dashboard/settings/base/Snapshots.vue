<script setup lang="ts">
import dayjs from 'dayjs'

const { t } = useI18n()

const { sorts, sortDirection, loadSorts, handleGetSortedData, saveOrUpdate: saveOrUpdateSort } = useUserSorts('Webhook')

const orderBy = computed<Record<string, SordDirectionType>>({
  get: () => {
    return sortDirection.value
  },
  set: (value: Record<string, SordDirectionType>) => {
    // Check if value is an empty object
    if (Object.keys(value).length === 0) {
      saveOrUpdateSort({})
      return
    }

    const [field, direction] = Object.entries(value)[0]

    saveOrUpdateSort({
      field,
      direction,
    })
  },
})

const {
  snapshots,
  createSnapshot,
  listSnapshots,
  cancelNewSnapshot,
  isUnsavedSnapshotsPending,
  addNewSnapshot,
  isCreatingSnapshot,
  newSnapshotTitle,
  isCooldownPeriodReached,
  isSnapshotCreationFailed,
} = useBaseSettings()

const sortedSnapshots = computed(() => handleGetSortedData(snapshots.value, sorts.value))

const columns = [
  {
    key: 'name',
    title: t('general.snapshot'),
    name: 'Snapshot',
    minWidth: 397,
    padding: '12px 24px',
    showOrderBy: true,
    dataIndex: 'title',
  },
  {
    key: 'action',
    title: t('general.action'),
    width: 162,
    minWidth: 162,
    justify: 'justify-end',
    align: 'center',
  },
] as NcTableColumnProps[]

onMounted(async () => {
  loadSorts()
  await listSnapshots()
})
const deleteSnapshot = (s: SnapshotExtendedType) => {
  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgSnapshotDelete'), {
    'modelValue': isOpen,
    'snapshot': s,
    'onUpdate:modelValue': closeDialog,
    'onDeleted': async () => {
      closeDialog()
      await listSnapshots()
    },
  })

  function closeDialog() {
    isOpen.value = false
    close(1000)
  }
}

const restoreSnapshot = (s: SnapshotExtendedType) => {
  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgSnapshotRestore'), {
    'modelValue': isOpen,
    'snapshot': s,
    'onUpdate:modelValue': closeDialog,
    'onRestored': async () => {
      closeDialog()
    },
  })

  function closeDialog() {
    isOpen.value = false
    close(1000)
  }
}
</script>

<template>
  <div v-if="isCreatingSnapshot" class="absolute w-full h-full inset-0 flex items-center justify-center z-90 bg-black/12">
    <div
      v-if="isCreatingSnapshot"
      style="box-shadow: 0px 8px 8px -4px rgba(0, 0, 0, 0.04), 0px 20px 24px -4px rgba(0, 0, 0, 0.1)"
      class="bg-white p-6 flex flex-col w-[488px] rounded-2xl"
    >
      <div class="text-nc-content-gray-emphasis text-lg font-bold">Creating base snapshot</div>
      <div class="text-nc-gray-subtle2 mt-2">
        Your database snapshot is being created. This process may take some time to complete. Please do not close this window
        until the snapshot has finished.
      </div>

      <div class="w-full flex justify-between items-center gap-3 mt-5">
        <GeneralLoader size="xlarge" />
      </div>
    </div>
  </div>

  <div class="flex flex-col w-full">
    <div class="text-nc-content-gray-emphasis font-semibold text-lg">
      {{ $t('general.baseSnapshots') }}
    </div>

    <div class="text-nc-content-gray-subtle2 mt-2 leading-5">
      {{ $t('labels.snapShotSubText') }}
    </div>

    <div class="flex items-center mt-6 gap-5">
      <NcButton
        :disabled="isUnsavedSnapshotsPending || isCooldownPeriodReached"
        type="ghost"
        class="!text-primary"
        data-testid="add-new-snapshot"
        size="small"
        :class="{
          '!text-nc-content-inverted-primary-disabled': isUnsavedSnapshotsPending || isCooldownPeriodReached,
        }"
        @click="addNewSnapshot"
      >
        {{ $t('labels.newSnapshot') }}
      </NcButton>
    </div>

    <div
      v-if="isSnapshotCreationFailed"
      class="mt-5 p-4 flex gap-4 border-1 relative rounded-lg border-nc-border-gray-extra-light justify-between"
    >
      <div class="flex w-full gap-4">
        <GeneralIcon icon="ncInfoSolid" class="text-nc-content-red-dark mt-1" />

        <div class="flex flex-col flex-1 w-full gap-1">
          <div class="text-[16px] leading-6 font-semibold">{{ $t('labels.snapshotCreationFailed') }}</div>
          <div class="leading-5 text-nc-content-gray-muted">
            {{ $t('labels.snapshotCreationFailedDescription') }}
          </div>
        </div>

        <NcButton type="text" class="right-0 top-0" size="small" @click="isSnapshotCreationFailed = false">
          <GeneralIcon icon="close" />
        </NcButton>
      </div>
    </div>

    <div
      v-else-if="isCooldownPeriodReached"
      class="mt-5 p-4 flex gap-4 border-1 rounded-lg border-nc-border-gray-extra-light justify-between"
    >
      <div class="flex w-full gap-4">
        <GeneralIcon icon="alertTriangleSolid" class="text-nc-content-orange-medium mt-1" />

        <div class="flex flex-1 flex-col gap-1">
          <div class="text-[16px] leading-6 font-semibold">
            {{ $t('labels.snapshotCooldownWarning') }}
          </div>
          <div class="leading-5 text-nc-content-gray-muted">
            {{ $t('labels.snapshotCooldownDescription') }}
          </div>
        </div>

        <NcButton type="text" class="right-0 top-0" size="small" @click="isCooldownPeriodReached = false">
          <GeneralIcon icon="close" />
        </NcButton>
      </div>
    </div>

    <NcTable
      v-model:order-by="orderBy"
      :columns="columns"
      header-row-height="44px"
      row-height="44px"
      :data="sortedSnapshots"
      class="h-full mt-5"
      body-row-class-name="nc-base-settings-snapshot-item no-border-last"
    >
      <template #bodyCell="{ column, record: snapshot }">
        <template v-if="column.key === 'name'">
          <NcTooltip v-if="!snapshot.isNew" class="truncate max-w-full text-gray-800 font-semibold text-sm">
            {{ snapshot.title }}

            <template #title>
              <div class="text-[10px] leading-[14px] uppercase font-semibold pt-1 text-gray-300">
                {{ $t('labels.createdOn') }}
              </div>
              <div class="mt-1 text-[13px]">
                {{ dayjs(snapshot.created_at).format('D MMMM YYYY, hh:mm A') }}
              </div>
              <div class="text-[10px] leading-[14px] uppercase font-semibold mt-2 text-gray-300">
                {{ $t('labels.createdBy') }}
              </div>
              <div class="mt-1 pb-1 text-[13px]">
                {{ snapshot.created_display_name }}
              </div>
            </template>
          </NcTooltip>
          <a-input v-else v-model:value="newSnapshotTitle" class="new-snapshot-title" />
          <div class="flex-1"></div>
          <NcBadge v-if="snapshot.status && snapshot.status !== 'success'" :border="false" color="red">
            <div class="flex text-nc-content-red-dark items-center gap-1">
              <GeneralIcon icon="ncAlertTriangle" />
              Snapshot failed
            </div>
          </NcBadge>
        </template>
        <template v-if="column.key === 'action'">
          <div
            v-if="!snapshot?.isNew"
            :data-testid="`snapshot-${snapshot.title}`"
            class="flex row-action items-center shadow-nc-sm rounded-lg"
          >
            <NcButton
              size="small"
              :disabled="snapshot.status !== 'success'"
              data-testid="restore-snapshot-btn"
              type="secondary"
              class="!text-sm !rounded-r-none !border-r-0"
              :shadow="false"
              @click="restoreSnapshot(snapshot)"
            >
              <div
                :class="{
                  'text-nc-content-inverted-primary-disabled': snapshot.status !== 'success',
                  'text-nc-content-gray-subtle': snapshot.status === 'success',
                }"
                class="font-semibold"
              >
                {{ $t('general.restore') }}
              </div>
            </NcButton>
            <NcButton
              size="small"
              type="secondary"
              data-testid="delete-snapshot-btn"
              class="!text-xs !rounded-l-none"
              :shadow="false"
              @click="deleteSnapshot(snapshot)"
            >
              <GeneralIcon icon="delete" />
            </NcButton>
          </div>

          <div v-else>
            <div class="flex gap-2">
              <NcButton data-testid="cancel-snapshot-btn" type="secondary" size="small" @click="cancelNewSnapshot()">
                {{ $t('general.cancel') }}
              </NcButton>

              <NcButton data-testid="create-snapshot-btn" type="primary" size="small" @click="createSnapshot(snapshot)">
                {{ $t('general.save') }}
              </NcButton>
            </div>
          </div>
        </template>
      </template>
    </NcTable>
  </div>
</template>

<style scoped lang="scss">
.ant-input {
  @apply rounded-lg py-1 px-3 w-398 h-8 border-1 focus:border-brand-500 border-gray-200;
}
</style>
