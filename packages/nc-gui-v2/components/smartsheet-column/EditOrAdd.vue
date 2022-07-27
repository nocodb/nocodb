<script lang="ts" setup>
import { computed, inject } from '#imports'
import { useColumnCreateStoreOrThrow } from '~/composables/useColumnCreateStore'
import { MetaInj } from '~/context'
import { uiTypes } from '~/utils/columnUtils'
import MdiPlusIcon from '~icons/mdi/plus-circle-outline'
import MdiMinusIcon from '~icons/mdi/minus-circle-outline'

const meta = inject(MetaInj)
const advancedOptions = ref(false)

const { formState, resetFields, validate, validateInfos, onUidtOrIdTypeChange, onAlter } = useColumnCreateStoreOrThrow()

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
  <div class="max-w-[450px] min-w-[350px] w-max max-h-[95vh] bg-white shadow p-4 overflow-auto" @click.stop>
    <a-form v-model="formState" layout="vertical">
      <a-form-item :label="$t('labels.columnName')" v-bind="validateInfos.column_name">
        <a-input
          v-model:value="formState.column_name"
          size="small"
          class="nc-column-name-input"
          @input="onAlter(8)"
        />
      </a-form-item>
      <a-form-item :label="$t('labels.columnType')">
        <a-select v-model:value="formState.uidt" size="small" class="nc-column-name-input" @change="onUidtOrIdTypeChange">
          <a-select-option v-for="opt in uiTypesOptions" :key="opt.name" :value="opt.name" v-bind="validateInfos.uidt">
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

      <div class="flex justify-end gap-1 mt-4">
        <a-button html-type="button" size="small">
          <!-- Cancel -->
          {{ $t('general.cancel') }}
        </a-button>
        <a-button html-type="submit" type="primary" size="small">
          <!-- Save -->
          {{ $t('general.save') }}
        </a-button>
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

:deep(.ant-form-item-explain-error) {
  @apply !text-[10px];
}

:deep(.ant-form-item-explain) {
  @apply !min-h-[15px];
}
</style>
