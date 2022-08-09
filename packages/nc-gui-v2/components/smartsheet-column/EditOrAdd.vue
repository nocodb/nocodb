<script lang="ts" setup>
import { UITypes, isVirtualCol } from 'nocodb-sdk'
import { computed, inject, useColumnCreateStoreOrThrow, useMetas, watchEffect } from '#imports'
import { MetaInj, ReloadViewDataHookInj } from '~/context'
import { uiTypes } from '~/utils/columnUtils'
import MdiPlusIcon from '~icons/mdi/plus-circle-outline'
import MdiMinusIcon from '~icons/mdi/minus-circle-outline'
import MdiIdentifierIcon from '~icons/mdi/identifier'

interface Props {
  editColumnDropdown?: boolean
}

const { editColumnDropdown } = defineProps<Props>()

const emit = defineEmits(['cancel'])
const meta = inject(MetaInj)
const reloadDataTrigger = inject(ReloadViewDataHookInj)
const advancedOptions = ref(false)
const { getMeta } = useMetas()

const formulaOptionsRef = ref()

const { formState, validateInfos, onUidtOrIdTypeChange, onAlter, addOrUpdate, generateNewColumnMeta, isEdit } =
  useColumnCreateStoreOrThrow()

const columnToValidate = [UITypes.Email, UITypes.URL, UITypes.PhoneNumber]

const onlyNameUpdateOnEditColumns = [UITypes.LinkToAnotherRecord, UITypes.Lookup, UITypes.Rollup]

const uiTypesOptions = computed<typeof uiTypes>(() => {
  return [
    ...uiTypes.filter((t) => !isEdit.value || !t.virtual),
    ...(!isEdit.value && meta?.value?.columns?.every((c) => !c.pk)
      ? [
          {
            name: UITypes.ID,
            icon: MdiIdentifierIcon,
            virtual: 0,
          },
        ]
      : []),
  ]
})

const reloadMetaAndData = () => {
  emit('cancel')
  getMeta(meta?.value.id as string, true)
  reloadDataTrigger?.trigger()
}

function onCancel() {
  emit('cancel')
  if (formState.value.uidt === UITypes.Formula) {
    // close formula drawer
    formulaOptionsRef.value.formulaSuggestionDrawer = false
  }
}

async function onSubmit() {
  await addOrUpdate(reloadMetaAndData)
  advancedOptions.value = false
}

// create column meta if it's a new column
watchEffect(() => {
  if (!isEdit.value) {
    generateNewColumnMeta()
  }
})

// focus and select the column name field
const antInput = ref()
watchEffect(() => {
  if (antInput.value && formState.value) {
    // todo: replace setTimeout
    setTimeout(() => {
      antInput.value.focus()
      antInput.value.select()
    }, 300)
  }
  advancedOptions.value = false
})

watch(
  () => editColumnDropdown,
  (v) => {
    if (v) {
      if (formState.value.uidt === UITypes.Formula) {
        formulaOptionsRef.value.formulaSuggestionDrawer = true
      }
    }
  },
)
</script>

<template>
  <div class="max-w-[550px] min-w-[450px] w-max max-h-[95vh] bg-white shadow p-4 overflow-auto" @click.stop>
    <a-form v-model="formState" name="column-create-or-edit" layout="vertical">
      <a-form-item :label="$t('labels.columnName')" v-bind="validateInfos.column_name">
        <a-input
          ref="antInput"
          v-model:value="formState.column_name"
          size="small"
          class="nc-column-name-input"
          @input="onAlter(8)"
        />
      </a-form-item>
      <a-form-item
        v-if="!(editColumnDropdown && !!onlyNameUpdateOnEditColumns.find((col) => col === formState.uidt))"
        :label="$t('labels.columnType')"
      >
        <a-select
          v-model:value="formState.uidt"
          show-search
          size="small"
          class="nc-column-type-input"
          @change="onUidtOrIdTypeChange"
        >
          <a-select-option v-for="opt of uiTypesOptions" :key="opt.name" :value="opt.name" v-bind="validateInfos.uidt">
            <div class="flex gap-1 align-center text-xs">
              <component :is="opt.icon" class="text-grey" />
              {{ opt.name }}
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>

      <SmartsheetColumnFormulaOptions v-if="formState.uidt === UITypes.Formula" ref="formulaOptionsRef" />
      <SmartsheetColumnCurrencyOptions v-if="formState.uidt === UITypes.Currency" />
      <SmartsheetColumnDurationOptions v-if="formState.uidt === UITypes.Duration" />
      <SmartsheetColumnRatingOptions v-if="formState.uidt === UITypes.Rating" />
      <SmartsheetColumnCheckboxOptions v-if="formState.uidt === UITypes.Checkbox" />
      <SmartsheetColumnLookupOptions v-if="!editColumnDropdown && formState.uidt === UITypes.Lookup" />
      <SmartsheetColumnDateOptions v-if="formState.uidt === UITypes.Date" />
      <SmartsheetColumnRollupOptions v-if="!editColumnDropdown && formState.uidt === UITypes.Rollup" />
      <SmartsheetColumnLinkedToAnotherRecordOptions
        v-if="!editColumnDropdown && formState.uidt === UITypes.LinkToAnotherRecord"
      />
      <SmartsheetColumnSpecificDBTypeOptions v-if="formState.uidt === UITypes.SpecificDBType" />
      <SmartsheetColumnPercentOptions v-if="formState.uidt === UITypes.Percent" />

      <div
        v-if="!isVirtualCol(formState.uidt)"
        class="text-xs cursor-pointer text-grey nc-more-options my-2 flex align-center gap-1 justify-end"
        @click="advancedOptions = !advancedOptions"
      >
        {{ advancedOptions ? $t('general.hideAll') : $t('general.showMore') }}
        <component :is="advancedOptions ? MdiMinusIcon : MdiPlusIcon" />
      </div>

      <div class="overflow-hidden" :class="advancedOptions ? 'h-min' : 'h-0'">
        <a-checkbox
          v-if="formState.meta && columnToValidate.includes(formState.uidt)"
          v-model:checked="formState.meta.validate"
          class="ml-1 mb-1"
        >
          <span class="text-[10px] text-gray-600">
            {{ `Accept only valid ${formState.uidt}` }}
          </span>
        </a-checkbox>
        <SmartsheetColumnAdvancedOptions />
      </div>
      <a-form-item>
        <div class="flex justify-end gap-1 mt-4">
          <a-button html-type="button" size="small" @click="onCancel">
            <!-- Cancel -->
            {{ $t('general.cancel') }}
          </a-button>
          <a-button html-type="submit" type="primary" size="small" @click="onSubmit">
            <!-- Save -->
            {{ $t('general.save') }}
          </a-button>
        </div>
      </a-form-item>
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
