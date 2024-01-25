<script lang="ts" setup>
import { computed, reactive } from '#imports'

interface Props {
  modelValue: boolean
  oidc?: {
    displayName?: string
    redirectUrl: string
    clientId: string
    authUrl: string
    clientSecret: string
    tokenUrl: string
    userInfoUrl: string
    jwkUrl: string
    scopes: string[]
    userNameAttribute: string
    ssoOnly?: boolean
  }
}

interface Form {
  displayName: string
  clientId: string
  clientSecret: string
  authUrl: string
  tokenUrl: string
  userInfoUrl: string
  jwkUrl: string
  scopes: string[]
  userNameAttribute: string
  ssoOnly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  oidc: {
    ssoOnly: false,
  },
})

const emit = defineEmits(['update:modelValue'])

const form = reactive<Form>({
  displayName: props.oidc.displayName || '',
  clientId: props.oidc.clientId,
  clientSecret: props.oidc.clientSecret,
  authUrl: props.oidc.authUrl,
  tokenUrl: props.oidc.tokenUrl,
  userInfoUrl: props.oidc.userInfoUrl,
  jwkUrl: props.oidc.jwkUrl,
  scopes: props.oidc.scopes,
  userNameAttribute: props.oidc.userNameAttribute,
  ssoOnly: props.oidc.ssoOnly,
})

const isSubmitEnabled = computed(() => {
  return form.displayName.length > 0
})

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text)
}

const dialogShow = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})
</script>

<template>
  <NcModal v-model:visible="dialogShow" @keydown.esc="dialogShow = false">
    <div class="font-bold mb-4 text-base">{{ $t('activity.registerOIDC') }}</div>
    <div class="overflow-y-auto h-[calc(min(75vh, 56rem))] pr-1 nc-scrollbar-md">
      <div class="gap-y-8 flex flex-col">
        <a-form :model="form">
          <input v-model="form.displayName" class="mb-4" placeholder="OIDC Display Name*" required />
          <div class="flex flex-col gap-2">
            <div class="flex w-full flex-row items-center">
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
              <span class="text-gray-800 overflow-hidden overflow-ellipsis whitespace-nowrap mr-2 flex-grow">
                https://idp.example.com/example_login/accounting_team_alhvd8WO
              </span>
              <NcButton
                size="xsmall"
                type="text"
                @click="
                  () => {
                    copyToClipboard(props.oidc.redirectUrl)
                  }
                "
              >
                <component :is="iconMap.copy" class="text-gray-800" />
              </NcButton>
            </div>
            <span class="text-xs text-gray-500">{{ $t('msg.info.idpPaste') }}</span>
          </div>

          <input v-model="form.clientId" class="mt-4" placeholder="Client ID*" required />
          <input v-model="form.clientSecret" class="mt-4" placeholder="Client Secret*" required />
          <input v-model="form.authUrl" class="mt-4" placeholder="Authorisation URL*" required />
          <input v-model="form.tokenUrl" class="mt-4" placeholder="Token URL*" required />
          <input v-model="form.userInfoUrl" class="mt-4" placeholder="User Info URL*" required />
          <input v-model="form.jwkUrl" class="mt-4" placeholder="JWK Set URL*" required />

          <input v-model="form.userNameAttribute" class="mt-4" placeholder="Username Attribute*" required />

          <div class="flex rounded-lg mt-4 border-1 border-gray-200 bg-orange-50 p-4 gap-4">
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
    <div class="flex justify-end gap-2 mt-4">
      <NcButton size="medium" type="secondary" @click="dialogShow = false">
        {{ $t('labels.cancel') }}
      </NcButton>
      <NcButton :disabled="!isSubmitEnabled" size="medium" type="primary">
        {{ $t('labels.save') }}
      </NcButton>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
input {
  @apply px-4 rounded-lg py-2 w-full border-1 focus:border-brand-500  border-gray-200 placeholder:text-gray-500 outline-none;
}
</style>
