<script setup lang="ts">
import { useColumnCreateStoreOrThrow } from '~/composables/useColumnCreateStore'

const { formState, validateInfos, setAdditionalValidations, sqlUi, onDataTypeChange, onAlter } = useColumnCreateStoreOrThrow()

const dataTypes = computed(() => sqlUi?.value?.getDataTypeListForUiType(formState))

// set additional validations
setAdditionalValidations({})

// to avoid type error with checkbox
formState.value.rqd = !!formState.value.rqd
formState.value.pk = !!formState.value.pk
formState.value.un = !!formState.value.un
formState.value.ai = !!formState.value.ai
formState.value.au = !!formState.value.au
</script>

<template>
  <div class="p-4 border-[2px] radius-1 border-grey w-full">
    <div class="flex justify-space-between">
      <a-form-item label="NN">
        <a-checkbox
          v-model:checked="formState.rqd"
          :disabled="formState.pk || !sqlUi.columnEditable(formState)"
          size="small"
          class="nc-column-name-input"
          @change="onAlter"
        />
      </a-form-item>
      <a-form-item label="PK">
        <a-checkbox
          v-model:checked="formState.pk"
          :disabled="!sqlUi.columnEditable(formState)"
          size="small"
          class="nc-column-name-input"
          @change="onAlter"
        />
      </a-form-item>
      <a-form-item label="AI">
        <a-checkbox
          v-model:checked="formState.ai"
          :disabled="sqlUi.colPropUNDisabled(formState) || !sqlUi.columnEditable(formState)"
          size="small"
          class="nc-column-name-input"
          @change="onAlter"
        />
      </a-form-item>
      <a-form-item
        label="UN"
        :disabled="sqlUi.colPropUNDisabled(formState) || !sqlUi.columnEditable(formState)"
        @change="onAlter"
      >
        <a-checkbox v-model:checked="formState.un" size="small" class="nc-column-name-input" />
      </a-form-item>
      <a-form-item
        label="AU"
        :disabled="sqlUi.colPropAuDisabled(formState) || !sqlUi.columnEditable(formState)"
        @change="onAlter"
      >
        <a-checkbox v-model:checked="formState.au" size="small" class="nc-column-name-input" />
      </a-form-item>
    </div>
    <a-form-item :label="$t('labels.databaseType')" v-bind="validateInfos.dt">
      <a-select v-model:value="formState.dt" size="small" @change="onDataTypeChange">
        <a-select-option v-for="type in dataTypes" :key="type" :value="type">
          {{ type }}
        </a-select-option>
      </a-select>
    </a-form-item>
    <a-form-item :label="$t('labels.lengthValue')">
      <a-input
        v-model:value="formState.dtxp"
        :disabled="sqlUi.getDefaultLengthIsDisabled(formState.dt) || !sqlUi.columnEditable(formState)"
        size="small"
        @input="onAlter"
      />
    </a-form-item>
    <a-form-item v-if="sqlUi.showScale(formState)" label="Scale">
      <a-input v-model="formState.dtxs" :disabled="!sqlUi.columnEditable(formState)" size="small" @input="onAlter" />
    </a-form-item>
    <a-form-item :label="$t('placeholder.defaultValue')">
      <a-textarea
        v-model="formState.cdf"
        :help="sqlUi.getDefaultValueForDatatype(formState.dt)"
        size="small"
        auto-size
        @input="onAlter(2, true)"
      />
    </a-form-item>
  </div>
</template>

<style scoped></style>
