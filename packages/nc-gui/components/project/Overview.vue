<script lang="ts" setup>
import type { TableType } from 'nocodb-sdk'

const { openedProject, isDataSourceLimitReached } = storeToRefs(useBases())

const baseStore = useBase()
const { base } = storeToRefs(baseStore)

const { isFeatureEnabled } = useBetaFeatureToggle()

const isNewBaseModalOpen = ref(false)

const isNewSyncModalOpen = ref(false)

const { isUIAllowed } = useRoles()

const { $e } = useNuxtApp()

const { showExternalSourcePlanLimitExceededModal } = useEeConfig()

const isImportModalOpen = ref(false)

const defaultBase = computed(() => {
  return openedProject.value?.sources?.[0]
})

function openTableCreateDialog(baseIndex?: number | undefined) {
  $e('c:table:create:navdraw')

  const isOpen = ref(true)
  let sourceId = openedProject.value!.sources?.[0].id
  if (typeof baseIndex === 'number') {
    sourceId = openedProject.value!.sources?.[baseIndex].id
  }

  if (!sourceId || !openedProject.value?.id) return

  const { close } = useDialog(resolveComponent('DlgTableCreate'), {
    'modelValue': isOpen,
    sourceId,
    'baseId': openedProject.value.id,
    'onCreate': closeDialog,
    'onUpdate:modelValue': () => closeDialog(),
  })

  function closeDialog(table?: TableType) {
    isOpen.value = false

    if (!table) return

    // TODO: Better way to know when the table node dom is available
    setTimeout(() => {
      const newTableDom = document.querySelector(`[data-table-id="${table.id}"]`)
      if (!newTableDom) return

      newTableDom?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 1000)

    close(1000)
  }
}

const onCreateBaseClick = () => {
  if (showExternalSourcePlanLimitExceededModal() || isDataSourceLimitReached.value) return

  isNewBaseModalOpen.value = true
}

const onCreateSyncClick = () => {
  isNewSyncModalOpen.value = true
}
</script>

<template>
  <div
    class="nc-all-tables-view p-6 nc-scrollbar-thin"
    :style="{
      height: 'calc(100vh - var(--topbar-height) - 44px)',
    }"
  >
    <div class="text-subHeading2 text-nc-content-gray mb-5">{{ $t('labels.actions') }}</div>
    <div
      class="flex flex-row gap-6 pb-2 flex-wrap max-w-[1000px]"
      :class="{
        'pointer-events-none': base?.isLoading,
      }"
    >
      <ProjectActionItem
        v-if="isUIAllowed('tableCreate', { source: base?.sources?.[0] })"
        :label="$t('dashboards.create_new_table')"
        :subtext="$t('msg.subText.startFromScratch')"
        data-testid="proj-view-btn__add-new-table"
        @click="openTableCreateDialog()"
      >
        <template #icon>
          <GeneralIcon icon="addOutlineBox" class="!h-8 !w-8 !text-brand-500" />
        </template>
      </ProjectActionItem>

      <ProjectActionItem
        v-if="isUIAllowed('tableCreate', { source: base?.sources?.[0] })"
        v-e="['c:table:import']"
        data-testid="proj-view-btn__import-data"
        :label="`${$t('activity.import')} ${$t('general.data')}`"
        :subtext="$t('msg.subText.importData')"
        @click="isImportModalOpen = true"
      >
        <template #icon>
          <GeneralIcon icon="download" class="!h-7.5 !w-7.5 !text-orange-700" />
        </template>
      </ProjectActionItem>

      <NcTooltip
        v-if="isUIAllowed('sourceCreate')"
        placement="bottom"
        :disabled="!isDataSourceLimitReached"
        class="flex-none flex"
      >
        <template #title>
          {{ $t('tooltip.reachedSourceLimit') }}
        </template>

        <ProjectActionItem
          v-e="['c:table:create-source']"
          class="nc-base-view-all-table-btn"
          data-testid="proj-view-btn__create-source"
          :disabled="isDataSourceLimitReached"
          :label="$t('labels.connectDataSource')"
          :subtext="$t('msg.subText.connectExternalData')"
          @click="onCreateBaseClick"
        >
          <template #icon>
            <GeneralIcon icon="server1" class="!h-7 !w-7 !text-green-700" />
          </template>
        </ProjectActionItem>
      </NcTooltip>

      <ProjectActionItem
        v-if="isFeatureEnabled(FEATURE_FLAG.SYNC) && isUIAllowed('tableCreate', { source: base?.sources?.[0] })"
        v-e="['c:table:create-sync']"
        class="nc-base-view-all-table-btn"
        data-testid="proj-view-btn__create-sync"
        :label="$t('labels.syncData')"
        :subtext="$t('msg.subText.syncData')"
        @click="onCreateSyncClick"
      >
        <template #icon>
          <GeneralIcon icon="ncZap" class="!h-7 !w-7 !text-green-700" />
        </template>
      </ProjectActionItem>
      <ProjectActionCreateEmptyScript />
      <ProjectActionScriptsByNocoDB />
    </div>
    <div
      v-if="base?.isLoading"
      class="flex items-center justify-center text-center mt-4"
      :style="{
        height: 'calc(100vh - var(--topbar-height) - 15.2rem)',
      }"
    >
      <div>
        <GeneralLoader size="xlarge" />
        <div class="mt-2">
          {{ $t('general.loading') }}
        </div>
      </div>
    </div>

    <ProjectImportModal v-if="defaultBase" v-model:visible="isImportModalOpen" :source="defaultBase" />
    <LazyDashboardSettingsDataSourcesCreateBase v-if="isNewBaseModalOpen" v-model:open="isNewBaseModalOpen" is-modal />
    <LazyDashboardSettingsSyncCreate
      v-if="isNewSyncModalOpen && base?.id"
      v-model:open="isNewSyncModalOpen"
      :base-id="base?.id"
    />
  </div>
</template>

<style lang="scss" scoped>
.nc-base-view-all-table-btn {
  @apply flex-none flex flex-col gap-y-3 p-4 bg-gray-50 rounded-xl border-1 border-gray-100 min-w-[230px] max-w-[245px] cursor-pointer text-gray-800 hover:(bg-gray-100 border-gray-200) transition-all duration-300;
  &:hover {
    box-shadow: 0px 0px 4px 0px rgba(0, 0, 0, 0.08);
  }

  .icon-wrapper {
    @apply w-8 h-8 flex items-center;
  }

  .nc-icon {
    @apply flex-none h-10 w-10;
  }

  .label {
    @apply text-base font-bold whitespace-nowrap text-gray-800;
  }

  .subtext {
    @apply text-xs text-gray-600;
  }
}

.nc-base-view-all-table-btn.disabled {
  @apply bg-gray-50 text-gray-400 hover:(bg-gray-50 text-gray-400) cursor-not-allowed;
}

.nc-text-icon {
  @apply flex-none w-5 h-5 rounded bg-white text-gray-800 text-[6px] leading-4 font-weight-800 flex items-center justify-center;
}
</style>
