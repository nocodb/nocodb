<script setup lang="ts">
import {
  ABUSE_REPORT_DESCRIPTION_MAX_LENGTH,
  ABUSE_REPORT_DESCRIPTION_MIN_LENGTH,
  ABUSE_REPORT_EMAIL_MAX_LENGTH,
  ABUSE_REPORT_NAME_MAX_LENGTH,
  AbuseReportReason,
} from 'nocodb-sdk'

interface Props {
  visible: boolean
  target: AbuseReportTarget
}

const props = defineProps<Props>()

const emits = defineEmits(['update:visible'])

const vVisible = useVModel(props, 'visible', emits)

const { $api, $e } = useNuxtApp()

const { t } = useI18n()

const { productName } = useBranding()

const formRef = ref()

const nameInputRef = ref()

const isSubmitting = ref(false)

const isSubmitted = ref(false)

const submitError = ref('')

const form = reactive({
  name: '',
  email: '',
  reason: undefined as AbuseReportReason | undefined,
  description: '',
  // Honeypot, visually hidden. People leave it empty.
  website: '',
})

const reasonOptions = computed(() =>
  Object.values(AbuseReportReason).map((value) => ({
    value,
    label: t(`labels.abuseReport.reasons.${value}`),
  })),
)

const rules = computed(() => ({
  name: [{ required: true, whitespace: true, message: t('general.required') }, { max: ABUSE_REPORT_NAME_MAX_LENGTH }],
  reason: [{ required: true, message: t('general.required') }],
  email: [
    { required: true, message: t('general.required') },
    { type: 'email', message: t('msg.error.invalidEmail') },
    { max: ABUSE_REPORT_EMAIL_MAX_LENGTH },
  ],
  description: [
    { required: true, whitespace: true, message: t('general.required') },
    {
      min: ABUSE_REPORT_DESCRIPTION_MIN_LENGTH,
      message: t('msg.info.abuseReport.detailsMin', { min: ABUSE_REPORT_DESCRIPTION_MIN_LENGTH }),
    },
    { max: ABUSE_REPORT_DESCRIPTION_MAX_LENGTH },
  ],
}))

async function submit() {
  submitError.value = ''

  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  isSubmitting.value = true

  try {
    await $api.public.abuseReportCreate(
      {
        resource_type: props.target.resourceType,
        identifier: props.target.identifier,
        reason: form.reason!,
        name: form.name.trim(),
        email: form.email.trim(),
        description: form.description.trim(),
        website: form.website,
      },
      props.target.password ? { headers: { 'xc-password': props.target.password } } : {},
    )

    isSubmitted.value = true

    $e('a:share:abuse-report:submit', { type: props.target.resourceType, reason: form.reason })
  } catch (e: any) {
    submitError.value = await extractSdkResponseErrorMsg(e)
  } finally {
    isSubmitting.value = false
  }
}

watch(vVisible, (visible) => {
  if (visible) {
    nextTick(() => nameInputRef.value?.focus())
    return
  }

  submitError.value = ''
  form.website = ''
  // Keep a typed draft across an accidental close; only a sent report clears it.
  if (isSubmitted.value) {
    form.reason = undefined
    form.description = ''
  }
  isSubmitted.value = false
})
</script>

<template>
  <NcModal
    v-model:visible="vVisible"
    width="min(calc(100vw - 32px), 480px)"
    height="auto"
    wrap-class-name="nc-report-abuse-modal-wrapper"
  >
    <div class="flex flex-col gap-4 max-h-[80vh] overflow-y-auto nc-scrollbar-thin" data-testid="nc-report-abuse-modal">
      <div class="flex items-center justify-between gap-2">
        <div class="text-base font-bold text-nc-content-gray-emphasis">{{ $t('labels.reportAbuse') }}</div>
        <NcButton type="text" size="small" @click="vVisible = false">
          <GeneralIcon icon="close" />
        </NcButton>
      </div>

      <template v-if="isSubmitted">
        <div class="flex flex-col gap-2 py-4" data-testid="nc-report-abuse-success">
          <div class="text-sm font-semibold text-nc-content-gray-emphasis">
            {{ $t('msg.info.abuseReport.thanksTitle') }}
          </div>
          <div class="text-sm text-nc-content-gray-subtle">
            {{ $t('msg.info.abuseReport.thanksDescription', { productName }) }}
          </div>
        </div>
        <div class="flex justify-end">
          <NcButton size="small" @click="vVisible = false">{{ $t('general.close') }}</NcButton>
        </div>
      </template>

      <template v-else>
        <div class="text-sm text-nc-content-gray-subtle">
          {{ $t('msg.info.abuseReport.description', { productName }) }}
        </div>

        <a-form ref="formRef" :model="form" :rules="rules" layout="vertical" class="nc-report-abuse-form" no-style>
          <a-form-item :label="$t('labels.abuseReport.yourName')" name="name">
            <a-input
              ref="nameInputRef"
              v-model:value="form.name"
              class="nc-input-sm nc-input-shadow"
              :maxlength="ABUSE_REPORT_NAME_MAX_LENGTH"
              autocomplete="name"
              data-testid="nc-report-abuse-name"
            />
          </a-form-item>

          <a-form-item :label="$t('labels.abuseReport.yourEmail')" name="email">
            <a-input
              v-model:value="form.email"
              class="nc-input-sm nc-input-shadow"
              type="email"
              :maxlength="ABUSE_REPORT_EMAIL_MAX_LENGTH"
              autocomplete="email"
              data-testid="nc-report-abuse-email"
            />
          </a-form-item>

          <a-form-item :label="$t('labels.abuseReport.reason')" name="reason">
            <NcSelect
              v-model:value="form.reason"
              :placeholder="$t('labels.abuseReport.reasonPlaceholder')"
              :options="reasonOptions"
              class="nc-select-shadow"
              data-testid="nc-report-abuse-reason"
            />
          </a-form-item>

          <a-form-item :label="$t('labels.abuseReport.details')" name="description">
            <a-textarea
              v-model:value="form.description"
              class="!rounded-lg !text-sm nc-input-shadow nc-scrollbar-thin"
              :auto-size="{ minRows: 5, maxRows: 10 }"
              :placeholder="$t('placeholder.abuseReportDetails')"
              :maxlength="ABUSE_REPORT_DESCRIPTION_MAX_LENGTH"
              show-count
              data-testid="nc-report-abuse-details"
            />
          </a-form-item>

          <input
            v-model="form.website"
            class="nc-report-abuse-hp"
            type="text"
            name="nc_hp_contact_url"
            tabindex="-1"
            autocomplete="off"
            aria-hidden="true"
          />
        </a-form>

        <NcAlert v-if="submitError" type="error" :description="submitError" data-testid="nc-report-abuse-error" />

        <div class="flex justify-end gap-2">
          <NcButton type="secondary" size="small" :disabled="isSubmitting" @click="vVisible = false">
            {{ $t('general.cancel') }}
          </NcButton>
          <NcButton size="small" :loading="isSubmitting" data-testid="nc-report-abuse-submit" @click="submit">
            {{ $t('labels.abuseReport.submit') }}
          </NcButton>
        </div>
      </template>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
.nc-report-abuse-form {
  :deep(.ant-form-item) {
    @apply mb-3;
  }

  :deep(.ant-form-item-label > label) {
    @apply text-sm text-nc-content-gray;
  }
}

// Off-screen rather than display:none, which some bots skip.
.nc-report-abuse-hp {
  position: absolute;
  left: -10000px;
  width: 1px;
  height: 1px;
  opacity: 0;
}
</style>
