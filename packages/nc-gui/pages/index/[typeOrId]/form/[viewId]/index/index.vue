<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isVirtualCol } from 'nocodb-sdk'
import { ref } from 'vue'

const {
  sharedFormView,
  submitForm,
  formState,
  notFound,
  formColumns,
  submitted,
  secondsRemain,
  isLoading,
  progress,
  validateInfos,
  validate,
  fieldMappings,
  meta,
  draftWasRestored,
  draftRestoredAt,
  discardDraft,
  dismissDraftBanner,
} = useSharedFormStoreOrThrow()

const { isMobileMode } = storeToRefs(useConfigStore())

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

const validateField = async (title: string) => {
  if (fieldMappings.value[title] === undefined) {
    console.warn('Missing mapping field for:', title)
    return false
  }

  try {
    await validate(fieldMappings.value[title])

    return true
  } catch (_e: any) {
    return false
  }
}

const { t } = useI18n()

// title of the field the scanner is filling; null while the scanner is closed
const scanFieldTitle = ref<string | null>(null)

const isScannerVisible = computed({
  get: () => !!scanFieldTitle.value,
  set: (visible: boolean) => {
    if (!visible) scanFieldTitle.value = null
  },
})

function onScanDecode(value: string) {
  const title = scanFieldTitle.value
  const column = formColumns.value?.find((el: ColumnType) => el.title === title)
  if (!title || !column) return

  let scannedValue: string | number = value
  if (column.uidt === UITypes.Number) {
    // a long numeric code (e.g. a 20-digit barcode) would lose digits as a number
    if (!/^-?\d+$/.test(value.trim()) || !Number.isSafeInteger(Number(value.trim()))) {
      message.error(t('msg.error.scannedValueNotANumber'))
      return
    }
    scannedValue = Number(value.trim())
  }

  formState.value[title] = scannedValue
  validateField(title)
}

const { message: templatedMessage } = useTemplatedMessage(
  computed(() => sharedFormView?.value?.success_msg),
  computed(() => formState.value),
  formColumns,
  meta,
)
</script>

<template>
  <div class="h-full flex flex-col items-center w-full max-w-[max(33%,688px)] mx-auto">
    <GeneralFormBanner
      v-if="sharedFormView && !parseProp(sharedFormView?.meta).hide_banner"
      :banner-image-url="sharedFormView.banner_image_url"
      class="flex-none"
    />

    <SmartsheetFormDraftRestoredBanner
      v-if="sharedFormView && !submitted && !notFound && draftWasRestored"
      :restored-at="draftRestoredAt"
      class="w-full mt-6 -mb-3"
      @discard="discardDraft"
      @close="dismissDraftBanner"
    />

    <div
      class="transition-all duration-300 ease-in relative flex flex-col justify-center gap-2 w-full my-6 bg-nc-bg-default rounded-3xl border-1 border-nc-border-gray-medium px-4 py-8 lg:p-12 md:(p-8)"
    >
      <template v-if="sharedFormView">
        <div>
          <h1 class="text-2xl font-bold text-nc-content-gray-emphasis mb-4">
            {{ sharedFormView.heading }}
          </h1>

          <div v-if="sharedFormView.subheading">
            <LazyCellRichText
              :value="sharedFormView.subheading"
              class="font-medium text-base text-nc-content-gray-muted !h-auto mb-4 -ml-1"
              is-form-field
              read-only
              sync-value-change
            />
          </div>
        </div>

        <a-alert v-if="notFound" type="warning" class="!mt-2 !mb-4 text-center" :message="$t('labels.notFound')" />

        <template v-else-if="submitted">
          <div class="flex justify-center">
            <div v-if="sharedFormView" class="w-full">
              <a-alert class="nc-shared-form-success-msg !mt-2 !mb-4 !py-4 text-left !rounded-lg" type="success" outlined>
                <template #message>
                  <LazyCellRichText
                    v-if="templatedMessage"
                    :value="templatedMessage"
                    class="!h-auto -ml-1"
                    is-form-field
                    read-only
                    sync-value-change
                  />
                  <span v-else> {{ $t('msg.successfullySubmittedFormData') }} </span>
                </template>
              </a-alert>

              <div
                v-if="
                  typeof sharedFormView?.redirect_url !== 'string' &&
                  (sharedFormView.show_blank_form || sharedFormView.submit_another_form)
                "
                class="mt-16 w-full flex justify-between items-center flex-wrap gap-3"
              >
                <p v-if="sharedFormView?.show_blank_form" class="text-sm text-nc-content-gray-muted m-0">
                  {{ $t('labels.newFormLoaded') }} {{ secondsRemain }} {{ $t('general.seconds').toLowerCase() }}
                </p>

                <div class="flex-1 self-end flex justify-end">
                  <NcButton
                    v-if="sharedFormView?.submit_another_form"
                    type="secondary"
                    :size="isMobileMode ? 'medium' : 'small'"
                    @click="submitted = false"
                  >
                    {{ $t('activity.submitAnotherForm') }}
                  </NcButton>
                </div>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <SmartsheetFormScannerModal v-model:visible="isScannerVisible" @decode="onScanDecode" />
          <GeneralOverlay class="bg-nc-bg-gray-extralight/75 rounded-3xl" :model-value="isLoading" inline transition>
            <div class="w-full h-full flex items-center justify-center">
              <a-spin size="large" />
            </div>
          </GeneralOverlay>

          <div class="nc-form-wrapper">
            <a-form :model="formState">
              <div class="nc-form h-full">
                <div class="flex flex-col gap-3 md:gap-6">
                  <div
                    v-for="(field, index) in formColumns"
                    :key="index"
                    class="flex flex-col gap-2"
                    :data-testid="`nc-shared-form-item-${toSafeClassName(field.title)}`"
                  >
                    <div class="nc-form-column-label text-sm font-semibold text-nc-content-gray">
                      <span>
                        {{ field.label || field.title }}
                      </span>
                      <span v-if="isRequired(field, field.required)" class="text-nc-content-red-medium text-base leading-[18px]"
                        >&nbsp;*</span
                      >
                    </div>
                    <div v-if="field?.description" class="nc-form-column-description text-nc-content-gray-muted text-sm">
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
                        <a-form-item
                          v-if="field.title && fieldMappings[field.title]"
                          :name="fieldMappings[field.title]"
                          class="!my-0 nc-input-required-error"
                          v-bind="validateInfos[fieldMappings[field.title]]"
                        >
                          <LazySmartsheetDivDataCell class="flex relative">
                            <LazySmartsheetVirtualCell
                              v-if="isVirtualCol(field)"
                              :model-value="null"
                              class="mt-0 nc-input nc-cell"
                              :data-testid="`nc-form-input-cell-${field.label || field.title}`"
                              :class="[`nc-form-input-${toSafeClassName(field.title)}`, { readonly: field?.read_only }]"
                              :column="field"
                              :read-only="field?.read_only"
                            />

                            <LazySmartsheetCell
                              v-else
                              v-model="formState[field.title]"
                              class="nc-input truncate"
                              :data-testid="`nc-form-input-cell-${field.label || field.title}`"
                              :class="[
                                `nc-form-input-${toSafeClassName(field.title)}`,
                                { 'layout-list': parseProp(field?.meta)?.isList, 'readonly': field?.read_only },
                              ]"
                              :column="field"
                              :edit-enabled="!field?.read_only"
                              :read-only="field?.read_only"
                              @update:model-value="
                                () => {
                                  validateField(field.title)
                                }
                              "
                            />
                            <NcTooltip v-if="field.enable_scanner" :title="$t('activity.fillByCodeScan')" class="flex-none">
                              <NcButton
                                type="secondary"
                                icon-only
                                class="nc-btn-fill-form-column-by-scan !w-10 !h-10 !px-0"
                                data-testid="nc-form-fill-by-scan"
                                @click="scanFieldTitle = field.title"
                              >
                                <template #icon>
                                  <component :is="iconMap.qrCodeScan" class="text-lg leading-none" />
                                </template>
                              </NcButton>
                            </NcTooltip>
                          </LazySmartsheetDivDataCell>
                        </a-form-item>
                      </NcTooltip>
                    </div>
                  </div>
                </div>

                <div class="flex justify-between items-center mt-6">
                  <div></div>

                  <NcButton
                    :disabled="progress"
                    type="primary"
                    :size="isMobileMode ? 'medium' : 'small'"
                    class="nc-shared-form-button shared-form-submit-button"
                    data-testid="shared-form-submit-button"
                    @click="submitForm"
                  >
                    {{ $t('general.submit') }}
                  </NcButton>
                </div>
              </div>
            </a-form>
          </div>
          <div>
            <a-divider class="!my-6 !md:my-8" />
            <div class="flex items-center justify-between gap-4">
              <div class="inline-block">
                <GeneralFormBranding />
              </div>
              <GeneralReportAbuseLink class="text-bodySm text-nc-content-gray-muted hover:!text-nc-content-gray-subtle" />
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
  @apply !p-1 !text-xs !w-7 !h-7 !flex !items-center !justify-center children:flex-none !cursor-pointer !transition;
}
.nc-btn-fill-form-column-by-scan {
  @apply h-auto;
  @apply ml-1;
}

.nc-shared-form-button {
  &.nc-button.ant-btn:focus {
    @apply shadow-focus;
  }
}

.nc-input-required-error {
  max-width: 100%;
  white-space: pre-line;
  :deep(.ant-form-item-explain-error) {
    &:first-child {
      @apply mt-2;
    }
  }

  &:focus-within {
    :deep(.ant-form-item-explain-error) {
      @apply text-nc-content-gray-disabled;
    }
  }
}

:deep(.ant-form-item-has-error .ant-select:not(.ant-select-disabled) .ant-select-selector) {
  border: none !important;
}
:deep(.ant-form-item-has-success .ant-select:not(.ant-select-disabled) .ant-select-selector) {
  border: none !important;
}
</style>
