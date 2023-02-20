<script lang="ts" setup>
import { RelationTypes, UITypes, isVirtualCol } from 'nocodb-sdk'
import { ref } from 'vue'
import { StreamBarcodeReader } from 'vue-barcode-reader'
import { useSharedFormStoreOrThrow } from '#imports'

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

const showCodeScannerOverlay = ref(false)

const scannerIsReady = ref(false)

const onLoaded = async () => {
  scannerIsReady.value = true
}

const showScannerIsLoadingMessage = computed(() => !scannerIsReady.value)

const onDecode = async (codeValue: string) => {
  if (!showScannerField.value) {
    return
  }
  try {
    showCodeScannerOverlay.value = false
    alert(`you scanned "${codeValue}"`)
  } catch (error) {
    console.error(error)
  }
}
</script>

<template>
  <div class="h-full flex flex-col items-center">
    <div
      class="color-transition relative flex flex-col justify-center gap-2 w-full max-w-[max(33%,600px)] m-auto py-4 pb-8 px-16 md:(bg-white dark:bg-slate-700 rounded-lg border-1 border-gray-200 shadow-xl)"
    >
      <template v-if="sharedFormView">
        <h1 class="prose-2xl font-bold self-center my-4">{{ sharedFormView.heading }}</h1>

        <h2 v-if="sharedFormView.subheading" class="prose-lg text-slate-500 dark:text-slate-300 self-center mb-4 leading-6">
          {{ sharedFormView.subheading }}
        </h2>

        <a-alert v-if="notFound" type="warning" class="my-4 text-center" message="Not found" />

        <template v-else-if="submitted">
          <div class="flex justify-center">
            <div v-if="sharedFormView" class="min-w-350px mt-3">
              <a-alert
                type="success"
                class="my-4 text-center"
                outlined
                :message="sharedFormView.success_msg || 'Successfully submitted form data'"
              />

              <p v-if="sharedFormView.show_blank_form" class="text-xs text-slate-500 dark:text-slate-300 text-center my-4">
                New form will be loaded after {{ secondsRemain }} seconds
              </p>

              <div v-if="sharedFormView.submit_another_form" class="text-center">
                <a-button type="primary" @click="submitted = false"> Submit Another Form</a-button>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
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
                      class="nc-input"
                      :data-testid="`nc-form-input-cell-${field.label || field.title}`"
                      :class="`nc-form-input-${field.title?.replaceAll(' ', '')}`"
                      :column="field"
                      :edit-enabled="true"
                    />

                    <div class="flex flex-col gap-2 text-slate-500 dark:text-slate-300 text-[0.75rem] my-2 px-1">
                      <div v-for="error of v$.localState[field.title]?.$errors" :key="error" class="text-red-500">
                        {{ error.$message }}
                      </div>

                      {{ field.description }}
                    </div>

                    <div>
                      SCANNER PLACEHOLDER
                      <a-button class="nc-btn-find-row-by-scan nc-toolbar-btn" @click="showCodeScannerOverlay = true">
                        <div class="flex items-center gap-1">
                          <QrCodeScan />
                          <span class="!text-xs font-weight-normal"> {{ $t('activity.findRowByCodeScan') }}</span>
                        </div>
                      </a-button>
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
                          <div>
                            <StreamBarcodeReader
                              v-show="scannerIsReady"
                              @decode="onDecode"
                              @loaded="onLoaded"
                            ></StreamBarcodeReader>
                            <div v-if="showScannerIsLoadingMessage" class="text-left text-wrap mt-2 text-[#e65100] text-xs">
                              {{ $t('msg.info.codeScanner.loadingScanner') }}
                            </div>
                          </div>
                        </div>
                      </a-modal>
                    </div>
                  </div>
                </div>
              </div>

              <div class="text-center mt-4">
                <button
                  type="submit"
                  class="uppercase scaling-btn prose-sm"
                  data-testid="shared-form-submit-button"
                  @click="submitForm"
                >
                  {{ $t('general.submit') }}
                </button>
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
</style>
