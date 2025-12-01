<script setup lang="ts">
import { AttachmentValidationType, type FileSizeValidation, PlanFeatureTypes, PlanTitles, type Validation } from 'nocodb-sdk'

const { activeField, updateColMeta } = useFormViewStoreOrThrow()

const { getPlanTitle } = useEeConfig()

const isEnabled = computed(() => {
  const result = {
    fileTypes: false,
    fileCount: false,
    fileSize: false,
  }
  if (!activeField.value) {
    return result
  }

  ;((activeField.value.meta.validators || []) as Validation[]).forEach((v) => {
    if (v.type === AttachmentValidationType.FileTypes) {
      result.fileTypes = true
    }
    if (v.type === AttachmentValidationType.FileCount) {
      result.fileCount = true
    }
    if (v.type === AttachmentValidationType.FileSize) {
      result.fileSize = true
    }
  })

  return result
})

const getFileTypesValidator = computed(() => {
  return ((activeField.value?.meta.validators || []) as Validation[]).find((val) => {
    return val.type === AttachmentValidationType.FileTypes
  })
})

const getFileCountValidator = computed(() => {
  return ((activeField.value?.meta.validators || []) as Validation[]).find((val) => {
    return val.type === AttachmentValidationType.FileCount
  })
})

const getFileSizeValidator = computed(() => {
  return ((activeField.value?.meta.validators || []) as Validation[]).find((val) => {
    return val.type === AttachmentValidationType.FileSize
  }) as FileSizeValidation
})

const addPlaceholderValidators = (value, type: AttachmentValidationType) => {
  if (!activeField.value) return

  if (value) {
    activeField.value.meta.validators = [
      ...(activeField.value.meta.validators || []),
      {
        type,
        value: null,
        message: '',
        ...(type === AttachmentValidationType.FileSize ? { unit: 'KB' } : {}),
      },
    ]
  } else {
    activeField.value.meta.validators = ((activeField.value.meta.validators || []) as Validation[]).filter((val) => {
      return val.type !== type
    })
    updateColMeta(activeField.value)
  }
}
</script>

<template>
  <template v-if="activeField">
    <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION">
      <template #default="{ click }">
        <div class="w-full flex items-start justify-between gap-3">
          <div class="flex-1 max-w-[calc(100%_-_40px)]">
            <div class="font-medium text-nc-content-gray flex items-center gap-2">
              <div
                class="cursor-pointer select-none flex items-center gap-2"
                @click="
                  click(
                    PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION,
                    () => addPlaceholderValidators(!isEnabled.fileTypes, AttachmentValidationType.FileTypes),
                    isEnabled.fileTypes,
                  )
                "
              >
                Limit file type
                <LazyPaymentUpgradeBadge
                  class="-my-1"
                  :feature="PlanFeatureTypes.FEATURE_HIDE_BRANDING"
                  :content="
                    $t('upgrade.upgradeToAccessFieldValidationSubtitle', {
                      plan: getPlanTitle(PlanTitles.PLUS),
                    })
                  "
                />
              </div>
            </div>
            <div class="text-nc-content-gray-muted mt-1">
              Manage user file uploads by specifying permitted MIME types.
              <template v-if="isEnabled.fileTypes">
                <br /><br />
                <b>Example:</b> <br />
                <b>image/png</b>: Allows PNG images only <br />
                <b>application/pdf</b>: Allows PDF documents only <b>image/*</b>: Allows all images <br /><br />
                Find MIME types for different file formats
                <a
                  href="https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types"
                  target="_blank"
                  rel="noopener noreferrer"
                  >here</a
                >. <br />
                <b> Note:</b> Use commas to separate MIME types
              </template>
            </div>

            <div v-if="isEnabled.fileTypes" class="nc-att-limit-file-type-wrapper mt-3 flex flex-col gap-1">
              <LazySmartsheetFormValidationInput
                v-if="getFileTypesValidator"
                :column="activeField"
                :validator="getFileTypesValidator"
                placeholder="image/jpg, video/mp4, text/plain "
                @update-validation-value="updateColMeta(activeField)"
              >
              </LazySmartsheetFormValidationInput>
              <LazySmartsheetFormValidationInputError :type="AttachmentValidationType.FileTypes" />
            </div>
          </div>

          <a-switch
            :checked="isEnabled.fileTypes"
            size="small"
            class="flex-none nc-form-switch-focus"
            data-testid="nc-att-limit-file-type"
            @change="
              click(
                PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION,
                () => addPlaceholderValidators($event, AttachmentValidationType.FileTypes),
                isEnabled.fileTypes,
              )
            "
          />
        </div>
      </template>
    </PaymentUpgradeBadgeProvider>
    <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION">
      <template #default="{ click }">
        <div class="w-full flex items-start justify-between gap-3">
          <div class="flex-1 max-w-[calc(100%_-_40px)]">
            <div
              class="font-medium text-nc-content-gray cursor-pointer select-none flex items-center gap-2"
              @click="
                click(
                  PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION,
                  () => addPlaceholderValidators(!isEnabled.fileCount, AttachmentValidationType.FileCount),
                  isEnabled.fileCount,
                )
              "
            >
              Limit number of files
              <LazyPaymentUpgradeBadge
                class="-my-1"
                :feature="PlanFeatureTypes.FEATURE_HIDE_BRANDING"
                :content="
                  $t('upgrade.upgradeToAccessFieldValidationSubtitle', {
                    plan: getPlanTitle(PlanTitles.PLUS),
                  })
                "
              />
            </div>
            <div class="text-nc-content-gray-muted mt-1">Limit the number of files that can be uploaded.</div>

            <div v-if="isEnabled.fileCount" class="nc-att-limit-file-count-wrapper mt-3 flex flex-col gap-1">
              <LazySmartsheetFormValidationInput
                v-if="getFileCountValidator"
                :column="activeField"
                :validator="getFileCountValidator"
                @update-validation-value="updateColMeta(activeField)"
              >
                <template #prefix> Maximum</template>
              </LazySmartsheetFormValidationInput>
              <LazySmartsheetFormValidationInputError :type="AttachmentValidationType.FileCount" />
            </div>
          </div>

          <a-switch
            :checked="isEnabled.fileCount"
            size="small"
            class="flex-none nc-form-switch-focus"
            data-testid="nc-att-limit-file-count"
            @change="
              click(
                PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION,
                () => addPlaceholderValidators($event, AttachmentValidationType.FileCount),
                isEnabled.fileCount,
              )
            "
          />
        </div>
      </template>
    </PaymentUpgradeBadgeProvider>
    <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION">
      <template #default="{ click }">
        <div class="w-full flex items-start justify-between gap-3">
          <div class="flex-1 max-w-[calc(100%_-_40px)]">
            <div
              class="font-medium text-nc-content-gray cursor-pointer select-none flex items-center gap-2"
              @click="
                click(
                  PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION,
                  () => addPlaceholderValidators(!isEnabled.fileSize, AttachmentValidationType.FileSize),
                  isEnabled.fileSize,
                )
              "
            >
              Limit files size

              <LazyPaymentUpgradeBadge
                class="-my-1"
                :feature="PlanFeatureTypes.FEATURE_HIDE_BRANDING"
                :content="
                  $t('upgrade.upgradeToAccessFieldValidationSubtitle', {
                    plan: getPlanTitle(PlanTitles.PLUS),
                  })
                "
              />
            </div>
            <div class="text-nc-content-gray-muted mt-1">Limit the size of files that can be uploaded. (Limit per file)</div>

            <div>
              <div v-if="isEnabled.fileSize" class="nc-att-limit-file-size-wrapper mt-3 flex gap-2">
                <LazySmartsheetFormValidationInput
                  v-if="getFileSizeValidator"
                  :column="activeField"
                  :validator="getFileSizeValidator"
                  @update-validation-value="updateColMeta(activeField)"
                >
                </LazySmartsheetFormValidationInput>

                <NcSelect
                  v-model:value="getFileSizeValidator.unit"
                  class="!w-[96px]"
                  :options="['KB', 'MB'].map((o) => ({ label: o, value: o }))"
                  dropdown-class-name="nc-att-limit-file-size-unit-selector-dropdown"
                />
              </div>
              <LazySmartsheetFormValidationInputError :type="AttachmentValidationType.FileSize" />
            </div>
          </div>

          <a-switch
            :checked="isEnabled.fileSize"
            size="small"
            class="flex-none nc-form-switch-focus"
            data-testid="nc-att-limit-file-size"
            @change="
              click(
                PlanFeatureTypes.FEATURE_FORM_FIELD_VALIDATION,
                () => addPlaceholderValidators($event, AttachmentValidationType.FileSize),
                isEnabled.fileSize,
              )
            "
          />
        </div>
      </template>
    </PaymentUpgradeBadgeProvider>
  </template>
</template>
