<script lang="ts" setup>
import type { RuleObject } from 'ant-design-vue/es/form'
import type { GoogleClientConfigType, SSOClientType } from 'nocodb-sdk'
import { computed, reactive, ref, useAuthentication, useCopy } from '#imports'

const props = defineProps<{
  modelValue: boolean
  isEdit: boolean
  google?: SSOClientType
}>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const { addProvider, updateProvider, getRedirectUrl } = useAuthentication()

const form = reactive<{ clientId: string; clientSecret: string }>({
  clientId: (props.google?.config as GoogleClientConfigType)?.clientId ?? '',
  clientSecret: (props.google?.config as GoogleClientConfigType)?.clientSecret ?? '',
})

const formRules = {
  clientId: [{ required: true, message: t('msg.error.clientIdRequired') }] as RuleObject[],
  clientSecret: [{ required: true, message: t('msg.error.clientSecretRequired') }] as RuleObject[],
}

const formValidator = ref()

const { copy } = useCopy()

const dialogShow = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const isCopied = ref({
  redirectUrl: false,
})

const copyRedirectUrl = async (redirectUrl: string) => {
  await copy(redirectUrl)
  isCopied.value.redirectUrl = true
}

watch(isCopied.value, (v) => {
  if (v.redirectUrl) {
    setTimeout(() => {
      isCopied.value.redirectUrl = false
    }, 2000)
  }
})

const saveGoogleProvider = async () => {
  const isValid = await formValidator.value.validate()
  if (!isValid) return
  if (props.isEdit) {
    await updateProvider(props.google.id, {
      title: 'google',
      config: {
        clientId: form.clientId,
        clientSecret: form.clientSecret,
      },
    })
    dialogShow.value = false
    return
  }
  await addProvider({
    title: 'google',
    config: {
      clientId: form.clientId,
      clientSecret: form.clientSecret,
    },
  })
  dialogShow.value = false
}
</script>

<template>
  <NcModal v-model:visible="dialogShow" class="nc-google-modal" data-test-id="nc-google-modal" @keydown.esc="dialogShow = false">
    <div class="font-bold mb-4 text-base">{{ $t('activity.googleOAuth') }}</div>
    <div class="overflow-y-auto h-[calc(min(40vh, 56rem))] pr-1 nc-scrollbar-md">
      <div class="gap-y-8 flex flex-col">
        <a-form ref="formValidator" :model="form">
          <div class="flex flex-col gap-2">
            <div class="flex flex-row items-center">
              <span class="text-gray-800">{{ $t('labels.redirectUrl') }}</span>
              <NcTooltip>
                <template #title>
                  This is the URL where authentication responses will be sent after successful login. Also referred to as
                  'Callback URL' or 'Reply URL'.
                </template>
                <component :is="iconMap.info" class="ml-1 text-gray-800" />
              </NcTooltip>
            </div>
            <div class="flex border-gray-200 border-1 bg-gray-50 items-center justify-between py-2 px-4 rounded-lg">
              <span class="text-gray-800 text-gray-800 overflow-hidden overflow-ellipsis whitespace-nowrap mr-2 flex-grow">
                <!-- Get Redirect URL from Authentication Composable -->
                {{ getRedirectUrl(google) }}
              </span>
              <NcButton size="xsmall" type="text" @click="copyRedirectUrl(getRedirectUrl(google))">
                <MdiCheck v-if="isCopied.redirectUrl" class="h-3.5" />
                <component :is="iconMap.copy" v-else class="text-gray-800" />
              </NcButton>
            </div>
            <span class="text-xs text-gray-500">{{ $t('msg.info.idpPaste') }}</span>
          </div>
          <a-form-item :rules="formRules.clientId" name="clientId">
            <a-input v-model:value="form.clientId" data-test-id="nc-google-clientId" placeholder="Client ID" />
          </a-form-item>

          <a-form-item :rules="formRules.clientSecret" name="clientSecret">
            <a-input v-model:value="form.clientSecret" data-test-id="nc-google-clientSecret" placeholder="Client Secret" />
          </a-form-item>

          <div class="flex justify-end gap-2 mt-8">
            <NcButton data-test-id="nc-google-submit" size="medium" type="primary" @click="saveGoogleProvider">
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
  @apply text-gray-500;
}

.ant-input {
  @apply px-4 rounded-lg py-2 w-full border-1 focus:border-brand-500 border-gray-200 !ring-0;
}
</style>
