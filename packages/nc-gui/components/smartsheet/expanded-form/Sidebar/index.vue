<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'

const props = defineProps<{
  showFieldsTab?: boolean
  /** Render the Fields tab content in compact mode. Forwarded straight to
   * MiniColumnsWrapper. */
  compactMode?: boolean
}>()

const { isSqlView } = useSmartsheetStoreOrThrow()

const expandedFormStore = useExpandedFormStoreOrThrow()

const { isExpandedFormCommentMode } = storeToRefs(useConfigStore())

const tab = ref<'fields' | 'comments' | 'audits'>(
  props.showFieldsTab && (!isExpandedFormCommentMode.value || isSqlView.value) ? 'fields' : 'comments',
)

watch(tab, (newValue) => {
  if (newValue === 'audits') {
    expandedFormStore.loadAudits()
  }
})

// Container-aware tab labels: when the sidebar itself is narrow (not the
// viewport), collapse each tab to icon-only and surface the label via tooltip.
// Below this threshold a 3-tab pill cannot host icon + label without elbowing
// each tab into <80 px which clips the labels anyway.
const sidebarRef = ref<HTMLElement>()
const sidebarWidth = ref(0)

useResizeObserver(sidebarRef, (entries) => {
  sidebarWidth.value = entries[0]?.contentRect.width ?? 0
})

const TAB_LABEL_THRESHOLD = 320
const isNarrow = computed(() => sidebarWidth.value > 0 && sidebarWidth.value < TAB_LABEL_THRESHOLD)
</script>

<template>
  <div ref="sidebarRef" class="flex flex-col bg-nc-bg-default !h-full w-full rounded-br-2xl overflow-hidden">
    <NcTabs v-model:active-key="tab" class="h-full">
      <a-tab-pane v-if="props.showFieldsTab" key="fields" class="w-full h-full">
        <template #tab>
          <NcTooltip :disabled="!isNarrow" :title="$t('objects.fields')">
            <div v-e="['c:row-expand:fields']" class="flex items-center gap-2">
              <GeneralIcon icon="fields" class="w-4 h-4" />
              <span v-show="!isNarrow"> {{ $t('objects.fields') }} </span>
            </div>
          </NcTooltip>
        </template>
        <SmartsheetExpandedFormPresentorsFieldsMiniColumnsWrapper :compact-mode="compactMode" />
      </a-tab-pane>

      <a-tab-pane v-if="!isSqlView" key="comments" class="w-full h-full">
        <template #tab>
          <NcTooltip :disabled="!isNarrow" :title="$t('general.comments')">
            <div v-e="['c:row-expand:comment']" class="flex items-center gap-2">
              <GeneralIcon icon="messageCircle" class="w-4 h-4" />
              <span v-show="!isNarrow"> {{ $t('general.comments') }} </span>
            </div>
          </NcTooltip>
        </template>
        <SmartsheetExpandedFormSidebarComments />
      </a-tab-pane>

      <a-tab-pane v-if="!isSqlView" key="audits" class="w-full">
        <template #tab>
          <NcTooltip :disabled="!isNarrow" :title="$t('labels.revisionHistory')">
            <div v-e="['c:row-expand:audit']" class="flex items-center gap-2">
              <GeneralIcon icon="audit" class="w-4 h-4" />
              <span v-show="!isNarrow"> {{ $t('labels.revisionHistory') }} </span>
            </div>
          </NcTooltip>
        </template>
        <SmartsheetExpandedFormSidebarAudits />
      </a-tab-pane>
    </NcTabs>
  </div>
</template>

<style lang="scss" scoped>
.tab {
  @apply max-w-1/2;
}

.tab .tab-title {
  @apply min-w-0 flex justify-center gap-2 font-semibold items-center;
  word-break: 'keep-all';
  white-space: 'nowrap';
  display: 'inline';
}

.text-decoration-line-through {
  text-decoration: line-through;
}

:deep(.ant-tabs) {
  @apply !overflow-visible;
  .ant-tabs-nav {
    @apply px-3 bg-nc-bg-default;
    .ant-tabs-nav-list {
      @apply w-[99%] mx-auto gap-6;

      .ant-tabs-tab {
        @apply flex-1 flex items-center justify-center pt-3 pb-2.5;

        & + .ant-tabs-tab {
          @apply !ml-0;
        }
      }
    }
  }
  .ant-tabs-content-holder {
    .ant-tabs-content {
      @apply h-full;
    }
  }
}
</style>

<style lang="scss">
.ant-tabs-dropdown {
  @apply overflow-hidden;
  .ant-tabs-dropdown-content {
    @apply !rounded-lg overflow-hidden border-1 border-nc-border-gray-medium;
  }
}
</style>
