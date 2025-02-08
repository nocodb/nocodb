<script setup lang="ts">
const props = defineProps<{
  showFieldsTab?: boolean
}>()

const expandedFormStore = useExpandedFormStoreOrThrow()
const isAuditsEnabled = true

const tab = ref<'fields' | 'comments' | 'audits'>(props.showFieldsTab ? 'fields' : 'comments')

watch(tab, (newValue) => {
  if (newValue === 'audits') {
    expandedFormStore.loadAudits()
  }
})
</script>

<template>
  <div class="flex flex-col bg-white !h-full w-full rounded-br-2xl overflow-hidden">
    <NcTabs v-model:activeKey="tab" class="h-full">
      <a-tab-pane v-if="props.showFieldsTab" key="fields" class="w-full h-full">
        <template #tab>
          <div v-e="['c:row-expand:fields']" class="flex items-center gap-2">
            <GeneralIcon icon="fields" class="w-4 h-4" />
            <span class="<lg:hidden"> {{ $t('objects.fields') }} </span>
          </div>
        </template>
        <SmartsheetExpandedFormPresentorsFieldsMiniColumnsWrapper />
      </a-tab-pane>

      <a-tab-pane key="comments" class="w-full h-full">
        <template #tab>
          <div v-e="['c:row-expand:comment']" class="flex items-center gap-2">
            <GeneralIcon icon="messageCircle" class="w-4 h-4" />
            <span class="<lg:hidden"> {{ $t('general.comments') }} </span>
          </div>
        </template>
        <SmartsheetExpandedFormSidebarComments />
      </a-tab-pane>

      <a-tab-pane key="audits" :disabled="!isAuditsEnabled" class="w-full">
        <template #tab>
          <NcTooltip v-if="!isAuditsEnabled" class="tab flex-1">
            <template #title>{{ $t('title.comingSoon') }}</template>

            <div v-e="['c:row-expand:audit']" class="flex items-center gap-2 text-gray-400">
              <GeneralIcon icon="audit" class="w-4 h-4" />
              <span class="<lg:hidden"> {{ $t('title.audits') }} </span>
            </div>
          </NcTooltip>

          <div v-else v-e="['c:row-expand:audit']" class="flex items-center gap-2">
            <GeneralIcon icon="audit" class="w-4 h-4" />
            <span class="<lg:hidden"> {{ $t('title.audits') }} </span>
          </div>
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
    @apply px-3 bg-white;
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
