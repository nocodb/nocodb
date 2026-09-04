<script setup lang="ts">
import { ColumnHelper, UITypes } from 'nocodb-sdk'

const props = defineProps<{
  value: any
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const meta = inject(MetaInj, ref())

const activeTabKey = ref<'fields' | 'formatting'>('fields')

// tracking specific fields relies on the row-meta column, which only
// EE + PG internal tables have — render plain formatting options elsewhere
const supportsFieldTracking = computed(() => (meta.value?.columns || []).some((c) => c.uidt === UITypes.Meta))

// seed date/time formatting defaults up-front — the Formatting tab pane is
// lazily mounted, so DateTimeOptions may never run its own seeding before save
vModel.value.meta = {
  ...ColumnHelper.getColumnDefaultMeta(UITypes.DateTime),
  ...(vModel.value.meta || {}),
}
</script>

<template>
  <div class="w-full">
    <NcTabs v-if="supportsFieldTracking" v-model:active-key="activeTabKey" class="nc-lmt-options-tabs">
      <a-tab-pane key="fields">
        <template #tab>
          <div class="tab" data-testid="nc-lmt-tab-fields">{{ $t('objects.fields') }}</div>
        </template>
        <div class="w-full pt-3">
          <SmartsheetColumnTrackedFieldsOptions v-model:value="vModel" />
        </div>
      </a-tab-pane>

      <a-tab-pane key="formatting">
        <template #tab>
          <div class="tab" data-testid="nc-lmt-tab-formatting">{{ $t('labels.formatting') }}</div>
        </template>
        <div class="w-full pt-3">
          <SmartsheetColumnDateTimeOptions v-model:value="vModel" />
        </div>
      </a-tab-pane>
    </NcTabs>

    <SmartsheetColumnDateTimeOptions v-else v-model:value="vModel" />
  </div>
</template>

<style scoped lang="scss">
.nc-lmt-options-tabs {
  :deep(.ant-tabs-nav) {
    @apply !mb-0 !pl-0;
  }

  :deep(.ant-tabs-nav-wrap) {
    @apply !pl-0;
  }

  :deep(.ant-tabs-tab) {
    @apply !pt-1 !pb-0;
  }

  :deep(.ant-tabs-tab-btn) {
    @apply !mb-1;
  }
}
</style>
