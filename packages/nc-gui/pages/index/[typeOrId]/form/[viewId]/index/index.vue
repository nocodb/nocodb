<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isVirtualCol } from 'nocodb-sdk'
import { ref } from 'vue'
import { StreamBarcodeReader } from 'vue-barcode-reader'
import { iconMap, useSharedFormStoreOrThrow } from '#imports'

const { sharedFormView, submitForm, v$, formState, notFound, formColumns, submitted, secondsRemain, isLoading } =
  useSharedFormStoreOrThrow()

function isRequired(_columnObj: Record<string, any>, required = false) {
  let columnObj = _columnObj
  if (
    columnObj.uidt === UITypes.LinkToAnotherRecord &&
    columnObj.colOptions &&
    columnObj.colOptions.type === RelationTypes.BELONGS_TO
  ) {
    columnObj = formColumns.value?.find((c) => c.id === columnObj.colOptions.fk_child_column_id) as Record<string, any>
  }

  return !!(required || (columnObj && columnObj.rqd && !columnObj.cdf))
}

const fieldTitleForCurrentScan = ref('')

const scannerIsReady = ref(false)

const showCodeScannerOverlay = ref(false)

const editEnabled = ref<boolean[]>([])

const onLoaded = async () => {
  scannerIsReady.value = true
}

const showCodeScannerForFieldTitle = (fieldTitle: string) => {
  showCodeScannerOverlay.value = true
  fieldTitleForCurrentScan.value = fieldTitle
}

const findColumnByTitle = (title: string) => formColumns.value?.find((el: ColumnType) => el.title === title)

const getScannedValueTransformerByFieldType = (fieldType: UITypes) => {
  switch (fieldType) {
    case UITypes.Number:
      return (originalVal: string) => parseInt(originalVal)
    default:
      return (originalVal: string) => originalVal
  }
}

const onDecode = async (scannedCodeValue: string) => {
  if (!showCodeScannerOverlay.value) {
    return
  }
  try {
    const fieldForCurrentScan = findColumnByTitle(fieldTitleForCurrentScan.value)
    if (fieldForCurrentScan == null) {
      throw new Error(`Field with title ${fieldTitleForCurrentScan.value} not found`)
    }
    const transformedVal =
      getScannedValueTransformerByFieldType(fieldForCurrentScan.uidt as UITypes)(scannedCodeValue) || scannedCodeValue
    formState.value[fieldTitleForCurrentScan.value] = transformedVal
    fieldTitleForCurrentScan.value = ''
    showCodeScannerOverlay.value = false
  } catch (error) {
    console.error(error)
  }
}
</script>

<template>
  <div class="h-full flex flex-col items-center">
    <div
      class="color-transition flex flex-col justify-center gap-2 w-full max-w-[max(33%,600px)] m-auto py-4 pb-8 px-16 md:(bg-white dark:bg-slate-700 rounded-lg border-1 border-gray-200 shadow-xl)"
    >
      <template v-if="sharedFormView">
        <h1 class="prose-2xl font-bold self-center my-4 break-words">
          {{ sharedFormView.heading }}
        </h1>

        <h2
          v-if="sharedFormView.subheading"
          class="prose-lg text-slate-500 dark:text-slate-300 self-center mb-4 leading-6 break-words"
        >
          {{ sharedFormView.subheading }}
        </h2>

        <a-alert v-if="notFound" type="warning" class="my-4 text-center" :message="$t('general.notFound')" />

        <template v-else-if="submitted">
          <div class="flex justify-center">
            <div v-if="sharedFormView" class="min-w-350px mt-3">
              <a-alert
                type="success"
                class="my-4 text-center"
                outlined
                :message="sharedFormView.success_msg || $t('msg.successfullySubmittedFormData')"
              />

              <p v-if="sharedFormView.show_blank_form" class="text-xs text-slate-500 dark:text-slate-300 text-center my-4">
                {{ $t('msg.newFormWillBeLoaded', { seconds: secondsRemain }) }}
              </p>

              <div v-if="sharedFormView.submit_another_form" class="text-center">
                <a-button type="primary" @click="submitted = false"> {{ $t('activity.submitAnotherForm') }}</a-button>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <a-modal
            v-model:visible="showCodeScannerOverlay"
            :closable="false"
            width="28rem"
            centered
            :footer="null"
            wrap-class-name="nc-modal-generate-token"
            destroy-on-close
            @cancel="scannerIsReady = false"
          >
            <div class="relative flex flex-col h-full">
              <StreamBarcodeReader v-show="scannerIsReady" @decode="onDecode" @loaded="onLoaded"> </StreamBarcodeReader>
            </div>
          </a-modal>
          <GeneralOverlay class="bg-gray-400/75" :model-value="isLoading" inline transition>
            <div class="w-full h-full flex items-center justify-center">
              <a-spin size="large" />
            </div>
          </GeneralOverlay>

          <div class="nc-form-wrapper">
            <div class="nc-form h-full">
              <div class="flex flex-col gap-6">
                <div v-for="(field, index) in formColumns" :key="index" class="flex flex-col gap-2">
                  <div class="flex nc-form-column-label">
                    <LazySmartsheetHeaderVirtualCell
                      v-if="isVirtualCol(field)"
                      :column="{ ...field, title: field.label || field.title }"
                      :required="isRequired(field, field.required)"
                      :hide-menu="true"
                    />

                    <LazySmartsheetHeaderCell
                      v-else
                      :column="{ ...field, title: field.label || field.title }"
                      :required="isRequired(field, field.required)"
                      :hide-menu="true"
                    />
                  </div>

                  <div>
                    <LazySmartsheetDivDataCell class="flex relative">
                      <LazySmartsheetVirtualCell
                        v-if="isVirtualCol(field)"
                        :model-value="null"
                        class="mt-0 nc-input nc-cell"
                        :data-testid="`nc-form-input-cell-${field.label || field.title}`"
                        :class="`nc-form-input-${field.title?.replaceAll(' ', '')}`"
                        :column="field"
                      />

                      <LazySmartsheetCell
                        v-else
                        v-model="formState[field.title]"
                        class="nc-input truncate"
                        :data-testid="`nc-form-input-cell-${field.label || field.title}`"
                        :class="`nc-form-input-${field.title?.replaceAll(' ', '')}`"
                        :column="field"
                        :edit-enabled="editEnabled[index]"
                        @click="editEnabled[index] = true"
                        @cancel="editEnabled[index] = false"
                        @update:edit-enabled="editEnabled[index] = $event"
                      />
                      <a-button
                        v-if="field.enable_scanner"
                        class="nc-btn-fill-form-column-by-scan nc-toolbar-btn"
                        :alt="$t('activity.fillByCodeScan')"
                        @click="showCodeScannerForFieldTitle(field.title)"
                      >
                        <div class="flex items-center gap-1">
                          <component :is="iconMap.qrCodeScan" class="h-5 w-5" />
                        </div>
                      </a-button>
                    </LazySmartsheetDivDataCell>

                    <div
                      class="flex flex-col gap-2 text-slate-500 dark:text-slate-300 text-[0.75rem] my-2 px-1 leading-[18px]"
                      style="word-break: break-word"
                    >
                      <div v-for="error of v$.localState[field.title]?.$errors" :key="error" class="text-red-500">
                        {{ error.$message }}
                      </div>

                      {{ field.description }}
                    </div>
                  </div>
                </div>
              </div>

              <div class="text-center mt-4">
                <NcButton type="primary" html-type="submit" data-testid="shared-form-submit-button" @click="submitForm">
                  {{ $t('general.submit') }}
                </NcButton>
              </div>
            </div>
          </div>
        </template>
      </template>
    </div>

    <div class="flex items-end">
      <GeneralPoweredBy />
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.nc-cell .nc-action-icon) {
  @apply !text-white-500 !bg-white/50 !rounded-full !p-1 !text-xs !w-7 !h-7 !flex !items-center !justify-center !cursor-pointer !hover: !bg-white-600 !hover: !text-white-600 !transition;
}
.nc-btn-fill-form-column-by-scan {
  @apply h-auto;
  @apply ml-1;
}
</style>
