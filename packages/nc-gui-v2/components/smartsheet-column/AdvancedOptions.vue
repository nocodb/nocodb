<script setup lang="ts">
import { UITypes } from 'nocodb-sdk'
import useProject from '~/composables/useProject'

const { sqlUi } = useProject()

const newColumn = reactive({ uidt: UITypes.SingleLineText })
const idType = null

const dataTypes = computed(() => sqlUi?.value?.getDataTypeListForUiType(newColumn))
</script>

<template>
  <div class="p-4 border-[2px] radius-1 border-grey w-full">
    <div class="flex justify-space-between">
      <a-form-item label="NN" :label-col="2">
        <a-checkbox size="small" class="nc-column-name-input" />
      </a-form-item>
      <a-form-item label="PK">
        <a-checkbox size="small" class="nc-column-name-input" />
      </a-form-item>
      <a-form-item label="AI">
        <a-checkbox size="small" class="nc-column-name-input" />
      </a-form-item>
      <a-form-item label="UN">
        <a-checkbox size="small" class="nc-column-name-input" />
      </a-form-item>
      <a-form-item label="AU">
        <a-checkbox size="small" class="nc-column-name-input" />
      </a-form-item>
    </div>
    <a-form-item :label="$t('labels.databaseType')">
      <a-select size="small">
        <a-select-option v-for="type in dataTypes" :key="type" :value="type">
          {{ type }}
        </a-select-option>
      </a-select>
    </a-form-item>
    <a-form-item
      :disabled="sqlUi.getDefaultLengthIsDisabled(newColumn.dt) || !sqlUi.columnEditable(newColumn)"
      :label="$t('labels.lengthValue')"
    >
      <a-input size="small" />
    </a-form-item>
    <a-form-item v-if="sqlUi.showScale(newColumn)" label="Scale">
      <a-input size="small" />
    </a-form-item>
    <a-form-item :help="sqlUi.getDefaultValueForDatatype(newColumn.dt)" :label="$t('placeholder.defaultValue')">
      <a-textarea size="small" auto-size />
    </a-form-item>
  </div>
</template>

<style scoped></style>
