<script lang="ts" setup>
import type { DomainType } from 'nocodb-sdk'
import type { RuleObject } from 'ant-design-vue/es/form'

const props = defineProps<{
  domain: DomainType
  modelValue?: boolean
  isEdit?: boolean
}>()

const emit = defineEmits(['update:modelValue', 'save'])

const { t } = useI18n()

const { updateDomain, addDomain } = useDomains()

const form = reactive<{ domain: string }>({
  domain: props.domain.domain ?? '',
})

watch(
  () => props.domain,
  (val) => {
    if (val) Object.assign(form, val)
  },
)

const formRules = {
  domain: [
    // Title is required
    { required: true, message: t('msg.error.domainRequired') },
  ] as RuleObject[],
}

const formValidator = ref()

const dialogShow = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const saveDomain = async () => {
  try {
    await formValidator.value.validate()
  } catch (e) {
    console.log(e)
    return
  }

  if (props.isEdit) {
    const res = await updateDomain(props.domain.id!, {
      domain: form.domain,
    })
    emit('save')
    if (res) {
      dialogShow.value = false
    }
    return
  }
  const res = await addDomain({
    domain: form.domain,
  })

  emit('save')
  if (res) {
    dialogShow.value = false
  }
}
</script>

<template>
  <NcModal v-model:visible="dialogShow" class="nc-org-domain-modal" data-test-id="nc-org-modal" @keydown.esc="dialogShow = false">
    <div class="font-bold mb-4 text-base">{{ $t('activity.addDomain') }}</div>
    <div class="overflow-y-auto h-[calc(min(40vh, 56rem))] pr-1 nc-scrollbar-md">
      <div class="gap-y-8 flex flex-col">
        <a-form ref="formValidator" :model="form">
          <div class="nc-form-step-container">
            <div class="nc-form-step-title">STEP 1: Enter Domain</div>
            <div class="nc-form-step-content-wrapper">
              <a-form-item :rules="formRules.domain" name="domain">
                <a-input v-model:value="form.domain" data-test-id="nc-org-domain-name" placeholder="Domain name" />
              </a-form-item>
            </div>
          </div>

          <div class="nc-form-step-container">
            <div class="nc-form-step-title">STEP 2: Verify Ownership</div>
            <div class="nc-form-step-content-wrapper">
              <div class="flex flex-col gap-2">
                <div class="flex flex-row items-center">
                  <span class="text-nc-content-gray">{{ $t('labels.txt') }}</span>
                  <NcTooltip>
                    <template #title> This is the value you have to set it in your DNS TXT record for verification. </template>
                    <component :is="iconMap.info" class="ml-1 text-nc-content-gray" />
                  </NcTooltip>
                </div>
                <div
                  class="flex border-nc-border-gray-medium border-1 bg-nc-bg-gray-extralight items-center justify-between py-2 px-4 rounded-lg"
                >
                  <span
                    class="text-nc-content-gray overflow-hidden overflow-ellipsis whitespace-nowrap mr-2 flex-grow"
                    data-test-id="nc-org-domain-txt-value"
                  >
                    {{ domain && domain.txt_value }}
                  </span>
                  <GeneralCopyButton :content="domain && domain.txt_value" />
                </div>
                <span class="text-xs text-nc-content-gray-muted">
                  To confirm ownership, please create a new TXT record in your DNS settings and paste the provided code into the
                  designated "Value" field.
                </span>
              </div>
            </div>
          </div>

          <NcAlert
            type="info"
            class="mt-3 mb-2"
            message="Domain Verification may take up to 48 hours"
            description="DNS record changes require up to 48 hours to fully propagate. If verification fails, kindly retry after allowing
              sufficient time for propagation."
          />

          <div class="flex justify-end gap-2 mt-8">
            <NcButton size="medium" type="secondary" @click="dialogShow = false">
              {{ $t('labels.cancel') }}
            </NcButton>
            <NcButton data-test-id="nc-org-domain-submit" size="medium" type="primary" @click="saveDomain">
              {{ $t('labels.save') }}
            </NcButton>
          </div>
        </a-form>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
.ant-input::placeholder {
  @apply text-nc-content-gray-muted;
}

.ant-input {
  @apply px-4 rounded-lg py-2 w-full border-1 focus:border-nc-border-brand border-nc-border-gray-medium !ring-0;
}

:deep(.ant-form-item) {
  @apply !mb-0;
}

.nc-form-step-container {
  @apply border-1 border-nc-border-gray-medium mt-3 mb-2 rounded-lg overflow-hidden;
  .nc-form-step-title {
    @apply bg-nc-bg-gray-extralight p-2 border-b-1 border-nc-border-gray-medium font-weight-medium;
  }

  .nc-form-step-content-wrapper {
    @apply p-3;
  }
}
</style>
