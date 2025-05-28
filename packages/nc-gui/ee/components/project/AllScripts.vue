<script lang="ts" setup>
import type { ScriptType } from 'nocodb-sdk'
import dayjs from 'dayjs'

const automationStore = useAutomationStore()

const { loadAutomations, openScript, openNewScriptModal: _openNewScriptModal } = automationStore

const { activeBaseAutomations, isAutomationsLoading, isMarketVisible, isDetailsVisible, detailsScriptId } =
  storeToRefs(automationStore)

const { openedProject } = storeToRefs(useBases())

const { t } = useI18n()

const columns = [
  {
    key: 'scriptName',
    title: t('objects.script'),
    name: 'Script Name',
    basis: '40%',
    minWidth: 220,
    padding: '0px 12px',
  },
  {
    key: 'created_at',
    title: t('labels.createdOn'),
    name: 'editor',
    minWidth: 120,
    padding: '0px 12px',
  },
] as NcTableColumnProps[]

const customRow = (record: Record<string, any>) => ({
  onclick: () => {
    openScript(record as ScriptType)
  },
})

async function openNewScriptModal() {
  _openNewScriptModal({
    baseId: openedProject.value?.id,
    loadAutomationsOnClose: true,
    scrollOnCreate: true,
  })
}

onMounted(async () => {
  await loadAutomations({ baseId: openedProject.value?.id })
})

const { isUIAllowed } = useRoles()

const openMarketPlace = () => {
  isMarketVisible.value = true
}
</script>

<template>
  <div class="nc-all-tables-view px-6 pt-6">
    <div
      v-if="isUIAllowed('scriptCreateOrEdit')"
      class="flex flex-row gap-x-6 pb-2 overflow-x-auto nc-scrollbar-thin"
      :class="{
        'pointer-events-none': isAutomationsLoading,
      }"
    >
      <div
        role="button"
        class="nc-base-view-all-scripts-btn"
        data-testid="proj-view-btn__add-new-script"
        @click="openNewScriptModal"
      >
        <div class="icon-wrapper">
          <GeneralIcon icon="addOutlineBox" class="!h-8 !w-8 !text-brand-500" />
        </div>
        <div class="flex flex-col gap-1">
          <div class="label">{{ $t('general.create') }} {{ $t('general.empty') }} {{ $t('objects.script') }}</div>
        </div>
      </div>
      <div
        role="button"
        class="nc-base-view-all-scripts-btn"
        data-testid="proj-view-btn__add-new-template-script"
        @click="openMarketPlace"
      >
        <div class="icon-wrapper">
          <GeneralIcon icon="ncScript" class="!h-8 !w-8 text-nc-content-maroon-dark" />
        </div>
        <div class="flex flex-col gap-1">
          <div class="label">{{ $t('labels.scriptsByNocoDB') }}</div>
        </div>
      </div>
    </div>
    <div
      v-if="isAutomationsLoading"
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

    <div
      v-else-if="activeBaseAutomations"
      class="flex mt-4"
      :style="{
        height: 'calc(100vh - var(--topbar-height) - 218px)',
      }"
    >
      <NcTable
        :is-data-loading="isAutomationsLoading"
        :columns="columns"
        sticky-first-column
        :data="[...activeBaseAutomations]"
        :custom-row="customRow"
        :bordered="false"
        class="nc-base-view-all-table-list flex-1"
      >
        <template #bodyCell="{ column, record }">
          <div
            v-if="column.key === 'scriptName'"
            class="w-full flex items-center gap-3 max-w-full text-gray-800"
            data-testid="proj-view-list__item-title"
          >
            <div class="min-w-6 flex items-center justify-center">
              <GeneralIcon icon="ncScript" class="flex-none text-gray-600" />
            </div>
            <NcTooltip class="truncate max-w-[calc(100%_-_28px)]" show-on-truncate-only>
              <template #title>
                {{ record?.title }}
              </template>
              {{ record?.title }}
            </NcTooltip>
          </div>

          <div
            v-if="column.key === 'created_at'"
            class="capitalize flex items-center gap-2 max-w-full"
            data-testid="proj-view-list__item-created-at"
          >
            {{ dayjs(record?.created_at).fromNow() }}
          </div>
        </template>
      </NcTable>
    </div>
    <div v-else class="py-3 flex items-center gap-6 <lg:flex-col">
      <img src="~assets/img/placeholder/table.png" class="!w-[23rem] flex-none" />
      <div class="text-center lg:text-left">
        <div class="text-2xl text-gray-800 font-bold">{{ $t('placeholder.createScripts') }}</div>
        <div class="text-sm text-gray-700 pt-6">
          {{ $t('placeholder.createScriptsLabel') }}
        </div>
      </div>
    </div>
  </div>

  <ScriptsMarket v-model:model-value="isMarketVisible" />
  <ScriptsDetails v-if="isDetailsVisible && detailsScriptId" v-model="isDetailsVisible" :script-id="detailsScriptId" />
</template>

<style lang="scss" scoped>
.nc-base-view-all-scripts-btn {
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

.nc-base-view-all-scripts-btn.disabled {
  @apply bg-gray-50 text-gray-400 hover:(bg-gray-50 text-gray-400) cursor-not-allowed;
}

.nc-text-icon {
  @apply flex-none w-5 h-5 rounded bg-white text-gray-800 text-[6px] leading-4 font-weight-800 flex items-center justify-center;
}
</style>
