<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'

const props = defineProps<{
  value: any
  advancedDbOptions: boolean
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const { onAlter, onDataTypeChange, validateInfos, sqlUi } = useColumnCreateStoreOrThrow()

// todo: 2nd argument of `getDataTypeListForUiType` is missing!
const dataTypes = computed(() => sqlUi.value.getDataTypeListForUiType(vModel.value as { uidt: UITypes }, '' as any))

const { isPg } = useBase()

const meta = inject(MetaInj, ref())

const hideLength = computed(() => {
  return [UITypes.SingleSelect, UITypes.MultiSelect].includes(vModel.value.uidt)
})

/* to avoid type error with checkbox
vModel.value.rqd = !!vModel.value.rqd
vModel.value.pk = !!vModel.value.pk
vModel.value.un = !!vModel.value.un
vModel.value.ai = !!vModel.value.ai
vModel.value.au = !!vModel.value.au */
</script>

<template>
  <div class="p-4 border-[0.1px] radius-1 rounded-lg border-grey w-full flex flex-col gap-2">
    <template v-if="props.advancedDbOptions">
      <div class="flex justify-between w-full gap-1">
        <a-form-item>
          <template #label>
            <span title="Not Null">NN</span>
          </template>
          <a-checkbox
            v-model:checked="vModel.rqd"
            :disabled="vModel.pk || !sqlUi.columnEditable(vModel)"
            class="nc-column-checkbox-NN"
            @change="onAlter"
          />
        </a-form-item>

        <a-form-item>
          <template #label>
            <span title="Primary Key">PK</span>
          </template>
          <a-checkbox
            v-model:checked="vModel.pk"
            :disabled="!sqlUi.columnEditable(vModel)"
            class="nc-column-checkbox-PK"
            @change="onAlter"
          />
        </a-form-item>

        <a-form-item>
          <template #label>
            <span title="Auto Increment">AI</span>
          </template>
          <a-checkbox
            v-model:checked="vModel.ai"
            :disabled="sqlUi.colPropUNDisabled(vModel) || !sqlUi.columnEditable(vModel)"
            class="nc-column-checkbox-AI"
            @change="onAlter"
          />
        </a-form-item>

        <a-form-item :disabled="sqlUi.colPropUNDisabled(vModel) || !sqlUi.columnEditable(vModel)" @change="onAlter">
          <template #label>
            <span title="Unsigned">UN</span>
          </template>
          <a-checkbox v-model:checked="vModel.un" class="nc-column-checkbox-UN" />
        </a-form-item>

        <a-form-item :disabled="sqlUi.colPropAuDisabled(vModel) || !sqlUi.columnEditable(vModel)" @change="onAlter">
          <template #label>
            <span title="Auto Update">AU</span>
          </template>
          <a-checkbox v-model:checked="vModel.au" class="nc-column-checkbox-AU" />
        </a-form-item>
      </div>

      <a-form-item :label="$t('labels.databaseType')" v-bind="validateInfos.dt">
        <a-select v-model:value="vModel.dt" dropdown-class-name="nc-dropdown-db-type" @change="onDataTypeChange">
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-gray-700" />
          </template>

          <a-select-option v-for="type in dataTypes" :key="type" :value="type">
            <div class="flex gap-2 items-center justify-between">
              {{ type }}
              <component :is="iconMap.check" v-if="vModel.dt === type" id="nc-selected-item-icon" class="text-primary w-4 h-4" />
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item v-if="!hideLength" :label="$t('labels.lengthValue')">
        <a-input
          v-model:value="vModel.dtxp"
          class="!rounded-lg"
          :disabled="sqlUi.getDefaultLengthIsDisabled(vModel.dt) || !sqlUi.columnEditable(vModel)"
          @input="onAlter"
        />
      </a-form-item>

      <a-form-item v-if="sqlUi.showScale(vModel)" label="Scale">
        <a-input v-model:value="vModel.dtxs" class="!rounded-lg" :disabled="!sqlUi.columnEditable(vModel)" @input="onAlter" />
      </a-form-item>

      <LazySmartsheetColumnPgBinaryOptions v-if="isPg(meta?.source_id) && vModel.dt === 'bytea'" v-model:value="vModel" />
    </template>
  </div>
</template>
