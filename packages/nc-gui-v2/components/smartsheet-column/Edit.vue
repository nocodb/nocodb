<script lang="ts" setup>
import { computed, inject } from '#imports'
import Smartsheet from '~/components/tabs/Smartsheet.vue'
import { MetaInj } from '~/context'
import { uiTypes } from '~/utils/columnUtils'
import MdiPlusIcon from '~icons/mdi/plus-circle-outline'
import MdiMinusIcon from '~icons/mdi/minus-circle-outline'

const meta = inject(MetaInj)
const advancedOptions = ref(false)

// todo: make as a prop
const editColumn = null

const uiTypesOptions = computed<typeof uiTypes>(() => {
  return [
    ...uiTypes.filter((t) => !editColumn || !t.virtual),
    ...(!editColumn && meta?.value?.columns?.every((c) => !c.pk)
      ? [
          {
            name: 'ID',
            icon: 'mdi-identifier',
          },
        ]
      : []),
  ]
})
</script>

<template>
  <div class="max-w-[300px] min-w-[300px] max-h-[95vh] bg-white shadow p-4" @click.stop>
    <a-form layout="vertical">
      <a-form-item :label="$t('labels.columnName')">
        <a-input size="small" class="nc-column-name-input" />
      </a-form-item>
      <a-form-item :label="$t('labels.columnType')">
        <a-select size="small" class="nc-column-name-input">
          <a-select-option v-for="opt in uiTypesOptions" :key="opt.name" :value="opt.name">
            <div class="flex gap-1 align-center text-xs">
              <component :is="opt.icon" class="text-grey" />
              {{ opt.name }}
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>

      <div>
        <div
          class="text-xs cursor-pointer text-grey nc-more-options my-2 flex align-center gap-1 justify-end"
          @click="advancedOptions = !advancedOptions"
        >
          {{ advancedOptions ? $t('general.hideAll') : $t('general.showMore') }}
          <component :is="advancedOptions ? MdiMinusIcon : MdiPlusIcon" />
        </div>
      </div>
      <div class="overflow-hidden" :class="advancedOptions ? 'h-min' : 'h-0'">
        <SmartsheetColumnAdvancedOptions />
      </div>
    </a-form>
  </div>
</template>

<style scoped>
:deep(.ant-form-item-label > label) {
  @apply !text-xs;
}

:deep(.ant-form-item-label) {
  @apply !pb-0;
}

:deep(.ant-form-item-control-input) {
  @apply !min-h-min;
}

:deep(.ant-form-item) {
  @apply !mb-1;
}

:deep(.ant-select-selection-item) {
  @apply flex align-center;
}
</style>
