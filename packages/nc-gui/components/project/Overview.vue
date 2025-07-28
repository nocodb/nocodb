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
      class="flex flex-row gap-6 flex-wrap max-w-[1000px]"
      :class="{
        'pointer-events-none': base?.isLoading,
      }"
    >
      <template v-if="base?.isLoading">
        <ProjectActionItem v-for="item in 7" :key="item" is-loading label="loading" />
      </template>
      <template v-else>
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
        <ProjectActionCreateEmptyDashboard />
      </template>
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
