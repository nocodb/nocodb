<script lang="ts" setup>
import { UITypes, isVirtualCol } from 'nocodb-sdk'
import {
  IsFormInj,
  IsKanbanInj,
  MetaInj,
  ReloadViewDataHookInj,
  computed,
  inject,
  message,
  onMounted,
  ref,
  uiTypes,
  useColumnCreateStoreOrThrow,
  useI18n,
  useMetas,
  useNuxtApp,
  watchEffect,
} from '#imports'
import MdiPlusIcon from '~icons/mdi/plus-circle-outline'
import MdiMinusIcon from '~icons/mdi/minus-circle-outline'
import MdiIdentifierIcon from '~icons/mdi/identifier'

const emit = defineEmits(['submit', 'cancel'])

const { formState, generateNewColumnMeta, addOrUpdate, onAlter, onUidtOrIdTypeChange, validateInfos, isEdit } =
  useColumnCreateStoreOrThrow()

const { getMeta } = useMetas()

const { t } = useI18n()

const { $e } = useNuxtApp()

const meta = inject(MetaInj, ref())

const isForm = inject(IsFormInj, ref(false))

const isKanban = inject(IsKanbanInj, ref(false))

const reloadDataTrigger = inject(ReloadViewDataHookInj)

const advancedOptions = ref(false)

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

const reloadMetaAndData = async () => {
  await getMeta(meta.value?.id as string, true)

  if (!isKanban.value) {
    reloadDataTrigger?.trigger()
  }
}

async function onSubmit() {
  const saved = await addOrUpdate(reloadMetaAndData)

  if (!saved) return

  // add delay to complete minimize transition
  setTimeout(() => {
    advancedOptions.value = false
  }, 500)
  emit('submit')

  if (isForm.value) {
    $e('a:form-view:add-new-field')
  }
}

// focus and select the column name field
const antInput = ref()
watchEffect(() => {
  if (antInput.value && formState.value) {
    // todo: replace setTimeout
    setTimeout(() => {
      // focus and select input only if active element is not an input or textarea
      if (document.activeElement === document.body || document.activeElement === null) {
        antInput.value?.focus()
        antInput.value?.select()
      }
    }, 300)
  }
  advancedOptions.value = false
})

onMounted(() => {
  if (!isEdit.value) {
    generateNewColumnMeta()
  } else {
    if (formState.value.pk) {
      message.info(t('msg.info.editingPKnotSupported'))
      emit('cancel')
    }
  }

  // for cases like formula
  if (formState.value && !formState.value.column_name) {
    formState.value.column_name = formState.value?.title
  }
})
</script>

<template>
  <div
    class="w-[400px] bg-gray-50 shadow p-4 overflow-auto border"
    :class="{ '!w-[600px]': formState.uidt === UITypes.Formula }"
    @click.stop
  >
    <a-form v-model="formState" no-style name="column-create-or-edit" layout="vertical" data-testid="add-or-edit-column">
      <div class="flex flex-col gap-2">
        <a-form-item :label="$t('labels.columnName')" v-bind="validateInfos.title">
          <a-input
            ref="antInput"
            v-model:value="formState.title"
            class="nc-column-name-input"
            :disabled="isKanban"
            @input="onAlter(8)"
          />
        </a-form-item>

        <a-form-item
          v-if="!(isEdit && !!onlyNameUpdateOnEditColumns.find((col) => col === formState.uidt))"
          :label="$t('labels.columnType')"
        >
          <a-select
            v-model:value="formState.uidt"
            show-search
            class="nc-column-type-input"
            :disabled="isKanban"
            dropdown-class-name="nc-dropdown-column-type"
            @change="onUidtOrIdTypeChange"
          >
            <a-select-option v-for="opt of uiTypesOptions" :key="opt.name" :value="opt.name" v-bind="validateInfos.uidt">
              <div class="flex gap-1 items-center">
                <component :is="opt.icon" class="text-grey" />
                {{ opt.name }}
              </div>
            </a-select-option>
          </a-select>
        </a-form-item>

        <LazySmartsheetColumnFormulaOptions v-if="formState.uidt === UITypes.Formula" v-model:value="formState" />
        <LazySmartsheetColumnCurrencyOptions v-if="formState.uidt === UITypes.Currency" v-model:value="formState" />
        <LazySmartsheetColumnDurationOptions v-if="formState.uidt === UITypes.Duration" v-model:value="formState" />
        <LazySmartsheetColumnRatingOptions v-if="formState.uidt === UITypes.Rating" v-model:value="formState" />
        <LazySmartsheetColumnCheckboxOptions v-if="formState.uidt === UITypes.Checkbox" v-model:value="formState" />
        <LazySmartsheetColumnLookupOptions v-if="!isEdit && formState.uidt === UITypes.Lookup" v-model:value="formState" />
        <LazySmartsheetColumnDateOptions v-if="formState.uidt === UITypes.Date" v-model:value="formState" />
        <LazySmartsheetColumnRollupOptions v-if="!isEdit && formState.uidt === UITypes.Rollup" v-model:value="formState" />
        <LazySmartsheetColumnLinkedToAnotherRecordOptions
          v-if="!isEdit && formState.uidt === UITypes.LinkToAnotherRecord"
          v-model:value="formState"
        />
        <LazySmartsheetColumnSpecificDBTypeOptions v-if="formState.uidt === UITypes.SpecificDBType" />
        <LazySmartsheetColumnSelectOptions
          v-if="formState.uidt === UITypes.SingleSelect || formState.uidt === UITypes.MultiSelect"
          v-model:value="formState"
        />
      </div>

      <div
        v-if="!isVirtualCol(formState.uidt)"
        class="text-xs cursor-pointer text-grey nc-more-options mb-1 mt-4 flex items-center gap-1 justify-end"
        @click="advancedOptions = !advancedOptions"
      >
        {{ advancedOptions ? $t('general.hideAll') : $t('general.showMore') }}
        <component :is="advancedOptions ? MdiMinusIcon : MdiPlusIcon" />
      </div>

      <Transition name="layout" mode="out-in">
        <div v-if="advancedOptions" class="overflow-hidden">
          <a-checkbox
            v-if="formState.meta && columnToValidate.includes(formState.uidt)"
            v-model:checked="formState.meta.validate"
            class="ml-1 mb-1"
          >
            <span class="text-[10px] text-gray-600">
              {{ `Accept only valid ${formState.uidt}` }}
            </span>
          </a-checkbox>

          <LazySmartsheetColumnAdvancedOptions v-model:value="formState" />
        </div>
      </Transition>

      <a-form-item>
        <div class="flex justify-end gap-1 mt-4">
          <a-button html-type="button" @click="emit('cancel')">
            <!-- Cancel -->
            {{ $t('general.cancel') }}
          </a-button>

          <a-button html-type="submit" type="primary" @click.prevent="onSubmit">
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
  @apply flex items-center;
}

:deep(.ant-form-item-explain-error) {
  @apply !text-[10px];
}

:deep(.ant-form-item-explain) {
  @apply !min-h-[15px];
}
</style>
