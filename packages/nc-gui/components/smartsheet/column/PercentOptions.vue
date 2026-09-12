<script setup lang="ts">
import { ColumnHelper, type ProgressBarShape, UITypes, progressBarShapes, readonlyMetaAllowedTypes } from 'nocodb-sdk'

const props = defineProps<{
  value: any
  isEdit?: boolean
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const { t } = useI18n()

const validators = {}

const { setAdditionalValidations } = useColumnCreateStoreOrThrow()

setAdditionalValidations({
  ...validators,
})

const precisionFormatsDisplay = makePrecisionFormatsDiplay(t)

const progressShapeLabels: Record<ProgressBarShape, string> = {
  bar: t('labels.progressShapeBar'),
  circle: t('labels.progressShapeCircle'),
}

// set default value
vModel.value.meta = {
  ...ColumnHelper.getColumnDefaultMeta(UITypes.Percent),
  ...(vModel.value.meta || {}),
}

// update datatype precision when precision is less than the new value
// avoid downgrading precision if the new value is less than the current precision
// to avoid fractional part data loss(eg. 1.2345 -> 1.23)
const onPrecisionChange = (value: number) => {
  vModel.value.dtxs = Math.max(value, vModel.value.dtxs)
}

const { isMetaReadOnly } = useRoles()

const { formState } = useColumnCreateStoreOrThrow()

const disableConfiguration = computed(
  () => Boolean(isMetaReadOnly.value) && !readonlyMetaAllowedTypes.includes(formState.value.uidt),
)
</script>

<template>
  <a-form-item :label="$t('placeholder.precision')">
    <a-select
      v-if="vModel.meta?.precision || vModel.meta?.precision === 0"
      v-model:value="vModel.meta.precision"
      :disabled="disableConfiguration"
      dropdown-class-name="nc-dropdown-percent-precision-format"
      @change="onPrecisionChange"
    >
      <template #suffixIcon>
        <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
      </template>
      <a-select-option v-for="(format, i) of precisionFormats" :key="i" :value="format">
        <div class="flex gap-2 w-full justify-between items-center">
          {{ (precisionFormatsDisplay as any)[format] }}
          <component
            :is="iconMap.check"
            v-if="vModel.meta.precision === format"
            id="nc-selected-item-icon"
            class="text-nc-content-brand w-4 h-4"
          />
        </div>
      </a-select-option>
    </a-select>
  </a-form-item>

  <a-form-item>
    <div class="flex items-center gap-1">
      <NcSwitch v-if="vModel.meta" v-model:checked="vModel.meta.is_progress">
        <div class="text-sm text-nc-content-gray select-none">{{ $t('labels.displayAsProgress') }}</div>
      </NcSwitch>
    </div>
  </a-form-item>

  <a-form-item v-if="vModel.meta?.is_progress" :label="$t('labels.progressBarShape')">
    <a-select
      v-model:value="vModel.meta.shape"
      :disabled="disableConfiguration"
      data-testid="nc-percent-progress-shape"
      dropdown-class-name="nc-dropdown-percent-progress-shape"
    >
      <template #suffixIcon>
        <GeneralIcon icon="arrowDown" class="text-nc-content-gray-subtle" />
      </template>
      <a-select-option
        v-for="shape of progressBarShapes"
        :key="shape"
        :value="shape"
        :data-testid="`nc-percent-progress-shape-${shape}`"
      >
        <div class="flex gap-2 w-full justify-between items-center">
          {{ progressShapeLabels[shape] }}
          <component
            :is="iconMap.check"
            v-if="vModel.meta.shape === shape"
            id="nc-selected-item-icon"
            class="text-nc-content-brand w-4 h-4"
          />
        </div>
      </a-select-option>
    </a-select>
  </a-form-item>
</template>
