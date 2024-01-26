<script lang="ts" setup>
import type { SSOClientType } from 'nocodb-sdk'
import { computed, reactive } from '#imports'

interface Props {
  modelValue: boolean
  saml: SSOClientType & {
    config: {
      metaDataUrl: string
    }
  }
}
interface Form {
  title: string
  metaDataUrl?: string
  xml?: string
  ssoOnly: boolean
}

const props = withDefaults(defineProps<Props>(), {
  saml: {
    title: '',
    config: {
      metaDataUrl: '',
      xml: '',
      redirectUrl: '',
      ssoOnly: false,
    },
    redirectUrl: '',
    ssoOnly: false,
  },
})

const emit = defineEmits(['update:modelValue'])

const { addProvider } = useAuthentication()

const form = reactive<Form>({
  title: props.saml.title ?? '',
  redirectUrl: props.saml.config.redirectUrl ?? '',
  metaDataUrl: props.saml.config.metaDataUrl ?? '',
  xml: props.saml.config.xml ?? '',
  ssoOnly: props.saml.config.ssoOnly ?? false,
})

const isSubmitEnabled = computed(() => {
  return form.title.length > 0 && (form.metaDataUrl || form.xml)
})

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text)
}

const activeTabKey = ref('metaDataURL')

const dialogShow = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const saveSamlProvider = async () => {
  console.log('saveSamlProvider', form)
  await addProvider({
    type: 'saml',
    title: form.title,
    config: {
      metaDataUrl: form.metaDataUrl,
      xml: form.xml,
      redirectUrl: form.redirectUrl,
      ssoOnly: form.ssoOnly,
    },
  })
  dialogShow.value = false
}
</script>

<template>
  <NcModal v-model:visible="dialogShow" @keydown.esc="dialogShow = false">
    <div class="font-bold mb-4 text-base">{{ $t('activity.registerSAML') }}</div>
    <div class="overflow-y-auto h-[calc(min(40vh, 56rem))] pr-1 nc-scrollbar-md">
      <div class="gap-y-8 flex flex-col">
        <a-form :model="form">
          <input v-model="form.title" class="mb-4" placeholder="SAML Display Name*" required />
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
                https://idp.example.com/example_login/accounting_team_alhvd8WO
              </span>
              <NcButton
                size="xsmall"
                type="text"
                @click="
                  () => {
                    copyToClipboard(props.saml.redirectUrl)
                  }
                "
              >
                <component :is="iconMap.copy" class="text-gray-800" />
              </NcButton>
            </div>
            <span class="text-xs text-gray-500">{{ $t('msg.info.idpPaste') }}</span>
          </div>
          <div class="flex flex-col my-8 gap-2">
            <div class="flex flex-row items-center">
              <span class="text-gray-800">{{ $t('labels.audience-entityId') }}</span>
              <NcTooltip>
                <template #title>
                  This is the unique identifier for your application that is expected by the Identity Provider (IDP). It helps the
                  IDP recognise and validate tokens issued specifically for your application.
                </template>
                <component :is="iconMap.info" class="ml-1 text-gray-800" />
              </NcTooltip>
            </div>
            <div class="flex border-gray-200 border-1 bg-gray-50 items-center justify-between py-2 px-4 rounded-lg">
              <span class="text-gray-800 text-gray-800 overflow-hidden overflow-ellipsis whitespace-nowrap mr-2 flex-grow">
                https://idp.example.com/example_login/accounting_team_alhvd8WO
              </span>
              <NcButton
                size="xsmall"
                type="text"
                @click="
                  () => {
                    copyToClipboard(props.saml.entityId)
                  }
                "
              >
                <component :is="iconMap.copy" class="text-gray-800" />
              </NcButton>
            </div>
            <span class="text-xs text-gray-500">{{ $t('msg.info.idpPaste') }}</span>
          </div>

          <a-tabs v-model:activeKey="activeTabKey" class="!pl-0 min-h-53">
            <a-tab-pane key="metaDataURL">
              <template #tab>
                <div class="text-sm">{{ $t('labels.metadataUrl') }}</div>
              </template>
              <a-form-item>
                <input v-model="form.metaDataUrl" placeholder="Paste the Metadata URL here from the Identity Provider" />
              </a-form-item>
            </a-tab-pane>
            <a-tab-pane key="xml">
              <template #tab>
                <div class="text-sm">XML</div>
              </template>
              <a-form-item>
                <textarea v-model="form.xml" placeholder="Paste the Metadata here from the Identity Provider" rows="5" />
              </a-form-item>
            </a-tab-pane>
          </a-tabs>

          <div class="flex rounded-lg border-1 border-gray-200 bg-orange-50 p-4 gap-4">
            <component :is="iconMap.info" class="text-yellow-500 h-6 w-6" />
            <div>
              <div class="text-gray-800 mb-1 font-bold">Allow SSO Log In only</div>
              <div class="text-gray-500">Enable SSO Logins only after testing metadata, by signing in using SSO.</div>
            </div>
            <NcSwitch v-model:checked="form.ssoOnly" />
          </div>
        </a-form>
      </div>
    </div>
    <div class="flex justify-end gap-2 mt-8">
      <NcButton size="medium" type="secondary" @click="dialogShow = false">
        {{ $t('labels.cancel') }}
      </NcButton>
      <NcButton size="medium" type="primary" @click="saveSamlProvider">
        {{ $t('labels.save') }}
      </NcButton>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
input {
  @apply px-4 rounded-lg py-2 w-full border-1 focus:border-brand-500  border-gray-200 placeholder:text-gray-500 outline-none;
}

textarea {
  @apply px-4 rounded-lg py-2 w-full border-1 focus:border-brand-500  border-gray-200 placeholder:text-gray-500 outline-none;
}
</style>
