<script setup lang="ts">
import { UITypes, isSelectTypeCol } from 'nocodb-sdk'

const { formState, activeField, updateColMeta, isRequired } = useFormViewStoreOrThrow()

const { isFeatureEnabled } = useBetaFeatureToggle()

const updateSelectFieldLayout = (value: boolean) => {
  if (!activeField.value) return

  activeField.value.meta.isList = value
  updateColMeta(activeField.value)
}

const columnSupportsScanning = (elementType: UITypes) =>
  isFeatureEnabled(FEATURE_FLAG.FORM_SUPPORT_COLUMN_SCANNING) &&
  [UITypes.SingleLineText, UITypes.Number, UITypes.Email, UITypes.URL, UITypes.LongText].includes(elementType)
</script>

<template>
  <!-- Field Settings -->
  <template v-if="activeField">
    <div class="nc-form-field-settings p-4 flex flex-col gap-4 border-b border-gray-200">
      <div class="text-sm font-bold text-gray-800">{{ $t('objects.field') }} {{ $t('activity.validations').toLowerCase() }}</div>
      <div class="flex flex-col gap-6">
        <div class="flex items-center justify-between gap-3">
          <div
            class="nc-form-input-required text-gray-800 font-medium"
            @click="
              () => {
                activeField.required = !activeField.required
                updateColMeta(activeField)
              }
            "
          >
            {{ $t('general.required') }} {{ $t('objects.field').toLowerCase() }}
          </div>

          <a-switch
            v-model:checked="activeField.required"
            v-e="['a:form-view:field:mark-required']"
            size="small"
            data-testid="nc-form-input-required"
            @change="updateColMeta(activeField)"
          />
        </div>

        <div v-if="columnSupportsScanning(activeField.uidt)" class="!my-0 nc-form-input-enable-scanner-form-item">
          <div class="flex items-center justify-between gap-3">
            <div class="nc-form-input-enable-scanner text-gray-800 font-medium">
              {{ $t('general.enableScanner') }}
            </div>
            <a-switch
              v-model:checked="activeField.enable_scanner"
              v-e="['a:form-view:field:mark-enable-scanner']"
              data-testid="nc-form-input-enable-scanner"
              size="small"
              @change="updateColMeta(activeField)"
            />
          </div>
        </div>

        <SmartsheetFormFieldSettingsVisibility />

        <!-- Limit options -->
        <div v-if="isSelectTypeCol(activeField.uidt)" class="w-full flex items-start justify-between gap-3">
          <div class="flex-1 max-w-[calc(100%_-_40px)]">
            <div class="font-medium text-gray-800">{{ $t('labels.limitOptions') }}</div>
            <div class="text-gray-500 mt-1">{{ $t('labels.limitOptionsSubtext') }}.</div>
            <div v-if="activeField.meta.isLimitOption" class="mt-3">
              <SmartsheetFormLimitOptions
                v-model:model-value="activeField.meta.limitOptions"
                :form-field-state="formState[activeField.title] || ''"
                :column="activeField"
                :is-required="isRequired(activeField, activeField.required)"
                @update:model-value="updateColMeta(activeField)"
                @update:form-field-state="(value)=>{
                                  formState[activeField!.title] = value
                                }"
              ></SmartsheetFormLimitOptions>
            </div>
          </div>

          <a-switch
            v-model:checked="activeField.meta.isLimitOption"
            v-e="['a:form-view:field:limit-options']"
            size="small"
            class="flex-none nc-form-switch-focus"
            @change="updateColMeta(activeField)"
          />
        </div>
      </div>
    </div>

    <!-- Field Appearance Settings -->
    <div
      v-if="isSelectTypeCol(activeField.uidt)"
      class="nc-form-field-appearance-settings p-4 flex flex-col gap-4 border-b border-gray-200"
    >
      <div class="text-sm font-bold text-gray-800">{{ $t('general.appearance') }}</div>
      <div class="flex flex-col gap-6">
        <!-- Select type field Options Layout  -->
        <div>
          <div class="text-gray-800 font-medium">Options layout</div>

          <a-radio-group
            :value="!!activeField.meta.isList"
            class="nc-form-field-layout !mt-3 max-w-[calc(100%_-_40px)]"
            @update:value="updateSelectFieldLayout"
          >
            <a-radio :value="false">{{ $t('general.dropdown') }}</a-radio>
            <a-radio :value="true">{{ $t('general.list') }}</a-radio>
          </a-radio-group>
        </div>
      </div>
    </div>
  </template>
</template>
