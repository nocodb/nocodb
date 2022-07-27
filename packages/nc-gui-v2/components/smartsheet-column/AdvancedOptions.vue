<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'
import { useColumnCreateStoreOrThrow } from '~/composables/useColumnCreateStore'
import useProject from '~/composables/useProject'

const { sqlUi } = useProject()

const newColumn = reactive({ uidt: UITypes.SingleLineText })
const idType = null

const dataTypes = computed(() => sqlUi?.value?.getDataTypeListForUiType(newColumn))

const { formState, validateInfos, setAdditionalValidations } = useColumnCreateStoreOrThrow()

// set additional validations
setAdditionalValidations({})

// to avoid type error with checkbox
formState.value.nn = !!formState.value.nn
formState.value.pk = !!formState.value.pk
formState.value.un = !!formState.value.un
formState.value.ai = !!formState.value.ai
formState.value.au = !!formState.value.au

</script>

<template>
  <div class="p-4 border-[2px] radius-1 border-grey w-full">

    <div class="flex justify-space-between">
      <a-form-item label="NN">
        <a-checkbox v-model:checked="formState.nn" size="small" class="nc-column-name-input" />
      </a-form-item>
      <a-form-item label="PK">
        <a-checkbox v-model:checked="formState.pk" size="small" class="nc-column-name-input" />
      </a-form-item>
      <a-form-item label="AI">
        <a-checkbox v-model:checked="formState.ai" size="small" class="nc-column-name-input" />
      </a-form-item>
      <a-form-item label="UN">
        <a-checkbox v-model:checked="formState.un" size="small" class="nc-column-name-input" />
      </a-form-item>
      <a-form-item label="AU">
        <a-checkbox v-model:checked="formState.au" size="small" class="nc-column-name-input" />
      </a-form-item>
    </div>
    <a-form-item :label="$t('labels.databaseType')" v-bind="validateInfos.dt">
      <a-select size="small" v-model:value="formState.dt">
        <a-select-option v-for="type in dataTypes" :key="type"  :value="type">
          {{ type }}
        </a-select-option>
      </a-select>
    </a-form-item>
    <a-form-item
      :disabled="sqlUi.getDefaultLengthIsDisabled(newColumn.dt) || !sqlUi.columnEditable(newColumn)"
      :label="$t('labels.lengthValue')"
    >
      <a-input v-model="newColumn.dtxp" size="small" />
    </a-form-item>
    <a-form-item v-if="sqlUi.showScale(newColumn)" label="Scale">
      <a-input v-model="newColumn.dtxs" size="small" />
    </a-form-item>
    <a-form-item :help="sqlUi.getDefaultValueForDatatype(newColumn.dt)" :label="$t('placeholder.defaultValue')">
      <a-textarea v-model="newColumn.cdf" size="small" auto-size />
    </a-form-item>
  </div>
</template>

<style scoped></style>
