<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isVirtualCol } from 'nocodb-sdk'
import { ref } from 'vue'
import { StreamBarcodeReader } from 'vue-barcode-reader'
import { iconMap, useSharedFormStoreOrThrow } from '#imports'

const {
  sharedFormView,
  submitForm,
  clearForm,
  v$,
  formState,
  notFound,
  formColumns,
  submitted,
  secondsRemain,
  isLoading,
  progress,
} = useSharedFormStoreOrThrow()

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
  <div class="h-full flex flex-col items-center w-full max-w-[max(33%,688px)] mx-auto">
    <GeneralFormBanner
      v-if="sharedFormView && !parseProp(sharedFormView?.meta).hide_banner"
      :banner-image-url="sharedFormView.banner_image_url"
      class="flex-none dark:border-none"
    />

    <div
      class="transition-all duration-300 ease-in relative flex flex-col justify-center gap-2 w-full my-6 bg-white dark:bg-transparent rounded-3xl border-1 border-gray-200 px-4 py-8 lg:p-12 md:(p-8 dark:bg-slate-700)"
    >
      <template v-if="sharedFormView">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-4">
            {{ sharedFormView.heading }}
          </h1>

          <div v-if="sharedFormView.subheading">
            <LazyCellRichText
              :value="sharedFormView.subheading"
              class="font-medium text-base text-gray-500 dark:text-slate-300 !h-auto mb-4 -ml-1"
              is-form-field
              read-only
              sync-value-change
            />
          </div>
        </div>

        <a-alert v-if="notFound" type="warning" class="!mt-2 !mb-4 text-center" message="Not found" />

        <template v-else-if="submitted">
          <div class="flex justify-center">
            <div v-if="sharedFormView" class="w-full">
              <a-alert class="!mt-2 !mb-4 !py-4 text-left !rounded-lg" type="success" outlined>
                <template #message>
                  <LazyCellRichText
                    v-if="sharedFormView?.success_msg?.trim()"
                    :value="sharedFormView?.success_msg"
                    class="!h-auto -ml-1"
                    is-form-field
                    read-only
                    sync-value-change
                  />
                  <span v-else> {{ $t('msg.successfullySubmittedFormData') }} </span>
                </template>
              </a-alert>

              <p v-if="sharedFormView.show_blank_form" class="text-xs text-slate-500 dark:text-slate-300 my-4">
                {{ $t('msg.newFormWillBeLoaded', { seconds: secondsRemain }) }}
              </p>

              <div v-if="sharedFormView.submit_another_form" class="text-right">
                <NcButton type="primary" size="medium" @click="submitted = false">
                  {{ $t('activity.submitAnotherForm') }}
                </NcButton>
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
          <GeneralOverlay class="bg-gray-50/75 rounded-3xl" :model-value="isLoading" inline transition>
            <div class="w-full h-full flex items-center justify-center">
              <a-spin size="large" />
            </div>
          </GeneralOverlay>

          <div class="nc-form-wrapper">
            <div class="nc-form h-full">
              <div class="flex flex-col gap-3 md:gap-6">
                <div v-for="(field, index) in formColumns" :key="index" class="flex flex-col gap-2">
                  <div class="nc-form-column-label text-sm font-semibold text-gray-800">
                    <span>
                      {{ field.label || field.title }}
                    </span>
                    <span v-if="isRequired(field, field.required)" class="text-red-500 text-base leading-[18px]">&nbsp;*</span>
                  </div>
                  <div v-if="field?.description" class="nc-form-column-description text-gray-500 text-sm">
                    <LazyCellRichText
                      :value="field?.description"
                      class="!h-auto -ml-1"
                      is-form-field
                      read-only
                      sync-value-change
                    />
                  </div>

                  <div>
                    <NcTooltip :disabled="!field?.read_only">
                      <template #title> {{ $t('activity.preFilledFields.lockedFieldTooltip') }} </template>
                      <LazySmartsheetDivDataCell class="flex relative">
                        <LazySmartsheetVirtualCell
                          v-if="isVirtualCol(field)"
                          :model-value="null"
                          class="mt-0 nc-input nc-cell"
                          :data-testid="`nc-form-input-cell-${field.label || field.title}`"
                          :class="[`nc-form-input-${field.title?.replaceAll(' ', '')}`, { readonly: field?.read_only }]"
                          :column="field"
                          :read-only="field?.read_only"
                        />

                        <LazySmartsheetCell
                          v-else
                          v-model="formState[field.title]"
                          class="nc-input truncate"
                          :data-testid="`nc-form-input-cell-${field.label || field.title}`"
                          :class="[
                            `nc-form-input-${field.title?.replaceAll(' ', '')}`,
                            { 'layout-list': parseProp(field?.meta)?.isList, 'readonly': field?.read_only },
                          ]"
                          :column="field"
                          :edit-enabled="!field?.read_only"
                          :read-only="field?.read_only"
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
                    </NcTooltip>

                    <div class="flex flex-col gap-2 text-slate-500 dark:text-slate-300 text-sm mt-2">
                      <template v-if="isVirtualCol(field)">
                        <div v-for="error of v$.virtual[field.title]?.$errors" :key="`${error}virtual`" class="text-red-500">
                          {{ error.$message }}
                        </div>
                      </template>
                      <template v-else>
                        <div v-for="error of v$.localState[field.title]?.$errors" :key="error" class="text-red-500">
                          {{ error.$message }}
                        </div>
                      </template>
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex justify-between items-center mt-6">
                <NcButton
                  html-type="reset"
                  type="secondary"
                  size="small"
                  :disabled="isLoading"
                  class="nc-shared-form-button shared-form-clear-button"
                  data-testid="shared-form-clear-button"
                  @click="clearForm"
                >
                  {{ $t('activity.clearForm') }}
                </NcButton>

                <NcButton
                  html-type="submit"
                  :disabled="progress"
                  type="primary"
                  size="small"
                  class="nc-shared-form-button shared-form-submit-button"
                  data-testid="shared-form-submit-button"
                  @click="submitForm"
                >
                  {{ $t('general.submit') }}
                </NcButton>
              </div>
            </div>
          </div>
          <div>
            <a-divider class="!my-6 !md:my-8" />
            <div class="inline-block">
              <GeneralFormBranding />
            </div>
          </div>
        </template>
      </template>
    </div>
    <div>&nbsp;</div>
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

.nc-shared-form-button {
  &.nc-button.ant-btn:focus {
    box-shadow: 0px 0px 0px 2px #fff, 0px 0px 0px 4px #3069fe;
  }
}
</style>
