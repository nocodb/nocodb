<script lang="ts" setup>
import type { TableType } from 'nocodb-sdk'

const { openedProject, isDataSourceLimitReached } = storeToRefs(useBases())

const baseStore = useBase()
const { base } = storeToRefs(baseStore)

const isNewBaseModalOpen = ref(false)

const { isMobileMode } = useGlobal()

const { isUIAllowed } = useRoles()

const { $e } = useNuxtApp()

const { t } = useI18n()

const { showEEFeatures, showExternalSourcePlanLimitExceededModal } = useEeConfig()

const { activeSidebarTab } = storeToRefs(useSidebarStore())

const tabActionLabel = computed(() => {
  const labels: Record<string, string> = {
    workflows: t('objects.workflow'),
    docs: t('objects.document'),
  }
  return labels[activeSidebarTab.value] ?? t('general.data')
})

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
</script>

<template>
  <div class="nc-all-tables-view py-4 px-6 nc-scrollbar-thin h-full overflow-y-auto">
    <div class="text-subHeading2 text-nc-content-gray mb-5 -mt-1.5">{{ tabActionLabel }} {{ $t('labels.actions') }}</div>

    <div
      class="nc-overview-actions flex flex-row gap-6 flex-wrap max-w-[1000px]"
      :class="{
        'pointer-events-none': base?.isLoading,
      }"
    >
      <template v-if="base?.isLoading">
        <ProjectActionItem v-for="item in 7" :key="item" is-loading label="loading" />
      </template>
      <template v-else>
        <!-- Data actions (shown on Data tab) -->
        <template v-if="activeSidebarTab === 'data'">
          <ProjectActionItem
            v-if="isUIAllowed('tableCreate', { source: base?.sources?.[0] })"
            :label="$t('dashboards.create_new_table')"
            :subtext="$t('msg.subText.startFromScratch')"
            data-testid="proj-view-btn__add-new-table"
            @click="openTableCreateDialog()"
          >
            <template #icon>
              <GeneralIcon icon="addOutlineBox" class="!h-8 !w-8 !text-nc-content-brand" />
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
              <GeneralIcon icon="download" class="!h-7.5 !w-7.5 !text-nc-content-orange-dark" />
            </template>
          </ProjectActionItem>

          <ProjectActionCreateNewDocument v-if="!isMobileMode && showEEFeatures" :base-id="base?.id" />

          <ProjectActionCreateEmptyDashboard v-if="!isMobileMode && showEEFeatures" />

          <ProjectActionCreateNewSync v-if="!isMobileMode && showEEFeatures" :base-id="base?.id" />

          <NcTooltip
            v-if="!isMobileMode && isUIAllowed('sourceCreate')"
            placement="bottom"
            :disabled="!isDataSourceLimitReached"
            class="flex-none flex"
          >
            <template #title>
              {{ $t('tooltip.reachedSourceLimit') }}
            </template>

            <ProjectActionItem
              v-if="!isMobileMode"
              v-e="['c:table:create-source']"
              data-testid="proj-view-btn__create-source"
              :disabled="isDataSourceLimitReached"
              :label="$t('labels.connectDataSource')"
              :subtext="$t('msg.subText.connectExternalData')"
              @click="onCreateBaseClick"
            >
              <template #icon>
                <GeneralIcon icon="server1" class="!h-7 !w-7 !text-nc-content-green-dark" />
              </template>
              <template #label>
                <NcTooltip
                  :title="$t('labels.connectDataSource')"
                  :disabled="isDataSourceLimitReached"
                  show-on-truncate-only
                  class="min-w-0 truncate"
                >
                  {{ $t('labels.connectDataSource') }}
                </NcTooltip>
              </template>
            </ProjectActionItem>
          </NcTooltip>
        </template>

        <!-- Automation actions (shown on Automation tab) -->
        <template v-if="activeSidebarTab === 'workflows' && !isMobileMode && showEEFeatures">
          <ProjectActionCreateEmptyWorkflow />
          <ProjectActionCreateEmptyScript />
          <ProjectActionScriptsByNocoDB />
        </template>
      </template>
    </div>

    <div v-if="!base.isLoading" class="nc-overview-empty-placeholder">
      <NcEmptyPlaceholder :title="$t('msg.noActionsAvailable')" />
    </div>

    <ProjectImportModal v-if="defaultBase" v-model:visible="isImportModalOpen" :source="defaultBase" />
    <LazyDashboardSettingsDataSourcesCreateBase v-if="isNewBaseModalOpen" v-model:open="isNewBaseModalOpen" is-modal />
  </div>
</template>

<style lang="scss" scoped>
.nc-overview-empty-placeholder {
  @apply mt-10;
  display: none;
}

.nc-overview-actions:empty ~ .nc-overview-empty-placeholder {
  display: block;
}
</style>
