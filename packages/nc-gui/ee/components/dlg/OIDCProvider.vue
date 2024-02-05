<script lang="ts" setup>
import type { SSOClientType } from 'nocodb-sdk'
import type { RuleObject } from 'ant-design-vue/es/form'
import { isValidURL as _isValidURL, computed, reactive, ref, useAuthentication } from '#imports'
import { urlValidator } from '~/utils'

const props = defineProps<{
  modelValue: boolean
  isEdit: boolean
  oidc?: SSOClientType
}>()

const emit = defineEmits(['update:modelValue'])

const { copy } = useCopy()

const isValidURL = (v: string) => {
  return _isValidURL(v, { require_tld: false })
}

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

const formValidator = ref()

const { t } = useI18n()

const { addProvider, updateProvider, getRedirectUrl } = useAuthentication()

const form = reactive<{
  title: string
  issuer: string
  clientId: string
  clientSecret: string
  authUrl: string
  tokenUrl: string
  userInfoUrl: string
  jwkUrl: string
  scopes: string[]
  userNameAttribute: string
  ssoOnly?: boolean
}>({
  title: props.oidc?.title ?? '',
  issuer: props.oidc?.config?.issuer ?? '',
  clientId: props.oidc?.config?.clientId ?? '',
  clientSecret: props.oidc?.config?.clientSecret ?? '',
  authUrl: props.oidc?.config?.authUrl ?? '',
  tokenUrl: props.oidc?.config?.tokenUrl ?? '',
  userInfoUrl: props.oidc?.config?.userInfoUrl ?? '',
  jwkUrl: props.oidc?.config?.jwkUrl ?? '',
  scopes: props.oidc?.config?.scopes ?? [],
  userNameAttribute: props.oidc?.config?.userNameAttribute ?? '',
  ssoOnly: props.oidc?.config?.ssoOnly ?? false,
})

const isButtonDisabled = computed(() => {
  return (
    !form.title ||
    !form.issuer ||
    !form.clientId ||
    !form.clientSecret ||
    !form.authUrl ||
    !form.tokenUrl ||
    !form.userInfoUrl ||
    !form.jwkUrl ||
    !form.userNameAttribute ||
    !form.scopes.length
  )
})

const formRules = {
  title: [
    // Title is required
    { required: true, message: t('msg.error.nameRequired') },
  ] as RuleObject[],
  clientId: [{ required: true, message: t('msg.error.clientIdRequired') }] as RuleObject[],
  issuer: [
    { required: true, message: t('msg.error.issuerRequired') },
    {
      validator: (_: unknown, v: string) => {
        return new Promise((resolve, reject) => {
          if (!v.length || isValidURL(v)) return resolve()

          reject(new Error(t('msg.error.invalidURL')))
        })
      },
      message: t('msg.error.issuerRequired'),
    },
  ] as RuleObject[],
  clientSecret: [{ required: true, message: t('msg.error.clientSecretRequired') }] as RuleObject[],
  authUrl: [
    { required: true, message: t('msg.error.authUrlRequired') },
    {
      urlValidator,
      message: t('msg.error.authUrlRequired'),
    },
  ] as RuleObject[],
  tokenUrl: [
    { required: true, message: t('msg.error.tokenUrlRequired') },
    {
      urlValidator,
      message: t('msg.error.tokenUrlRequired'),
    },
  ] as RuleObject[],
  userInfoUrl: [
    { required: true, message: t('msg.error.userInfoUrlRequired') },
    {
      urlValidator,
      message: t('msg.error.userInfoUrlRequired'),
    },
  ] as RuleObject[],
  jwkUrl: [
    { required: true, message: t('msg.error.jwkUrlRequired') },
    {
      urlValidator,
      message: t('msg.error.jwkUrlRequired'),
    },
  ] as RuleObject[],
  userNameAttribute: [{ required: true, message: t('msg.error.userNameAttributeRequired') }] as RuleObject[],
  scopes: [{ required: true, message: t('msg.error.scopesRequired') }] as RuleObject[],
}

const dialogShow = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const saveOIDCProvider = async () => {
  const isValid = await formValidator.value.validate()
  if (!isValid) return
  if (props.isEdit) {
    const res = await updateProvider(props.oidc?.id ?? '', {
      title: form.title,
      config: {
        clientId: form.clientId,
        issuer: form.issuer,
        clientSecret: form.clientSecret,
        authUrl: form.authUrl,
        tokenUrl: form.tokenUrl,
        userInfoUrl: form.userInfoUrl,
        jwkUrl: form.jwkUrl,
        scopes: form.scopes,
        userNameAttribute: form.userNameAttribute,
        ssoOnly: form.ssoOnly,
      },
    })
    if (res) dialogShow.value = false
    return
  }
  const res = await addProvider({
    type: 'oidc',
    enabled: true,
    title: form.title,
    config: {
      clientId: form.clientId,
      issuer: form.issuer,
      clientSecret: form.clientSecret,
      authUrl: form.authUrl,
      tokenUrl: form.tokenUrl,
      userInfoUrl: form.userInfoUrl,
      jwkUrl: form.jwkUrl,
      scopes: form.scopes,
      userNameAttribute: form.userNameAttribute,
      ssoOnly: form.ssoOnly,
    },
  })
  if (res) dialogShow.value = false
}
</script>

<template>
  <NcModal
    v-model:visible="dialogShow"
    class="nc-oidc-modal"
    data-test-id="nc-oidc-modal"
    size="medium"
    @keydown.esc="dialogShow = false"
  >
    <div class="font-bold mb-4 text-base">{{ $t('activity.registerOIDC') }}</div>
    <div class="overflow-y-auto h-[calc(min(75vh, 56rem))] pr-1 nc-scrollbar-md">
      <div class="gap-y-8 flex flex-col">
        <a-form ref="formValidator" :model="form">
          <a-form-item :rules="formRules.title" name="title">
            <a-input v-model:value="form.title" data-test-id="nc-oidc-title" placeholder="OIDC Display Name*" />
          </a-form-item>

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
              <span
                class="text-gray-800 overflow-hidden overflow-ellipsis whitespace-nowrap mr-2 flex-grow"
                data-test-id="nc-openid-redirect-url"
              >
                {{ getRedirectUrl(oidc) }}
              </span>
              <NcButton size="xsmall" type="text" @click="copyRedirectUrl(getRedirectUrl(oidc))">
                <MdiCheck v-if="isCopied.redirectUrl" class="h-3.5" />
                <component :is="iconMap.copy" v-else class="text-gray-800" />
              </NcButton>
            </div>
            <span class="text-xs text-gray-500">{{ $t('msg.info.idpPaste') }}</span>
          </div>

          <a-form-item :rules="formRules.issuer" name="issuer">
            <a-input v-model:value="form.issuer" class="!mt-4" data-test-id="nc-oidc-issuer" placeholder="Issuer*" />
          </a-form-item>

          <a-form-item :rules="formRules.clientId" name="clientId">
            <a-input v-model:value="form.clientId" class="!mt-4" data-test-id="nc-oidc-client-id" placeholder="Client ID*" />
          </a-form-item>

          <a-form-item :rules="formRules.clientSecret" name="clientSecret">
            <a-input
              v-model:value="form.clientSecret"
              class="mt-4"
              data-test-id="nc-oidc-client-secret"
              placeholder="Client Secret*"
              required
            />
          </a-form-item>

          <a-form-item :rules="formRules.authUrl" name="authUrl">
            <a-input
              v-model:value="form.authUrl"
              class="mt-4"
              data-test-id="nc-oidc-auth-url"
              placeholder="Authorisation URL*"
              required
              type="url"
            />
          </a-form-item>
          <a-form-item :rules="formRules.tokenUrl" name="tokenUrl">
            <a-input
              v-model:value="form.tokenUrl"
              class="mt-4"
              data-test-id="nc-oidc-tokenUrl"
              placeholder="Token URL*"
              required
              type="url"
            />
          </a-form-item>
          <a-form-item :rules="formRules.userInfoUrl" name="userInfoUrl">
            <a-input
              v-model:value="form.userInfoUrl"
              class="mt-4"
              data-test-id="nc-oidc-userInfoUrl"
              placeholder="User Info URL*"
              required
              type="url"
            />
          </a-form-item>
          <a-form-item :rules="formRules.jwkUrl" name="jwkUrl">
            <a-input
              v-model:value="form.jwkUrl"
              class="mt-4"
              data-test-id="nc-oidc-jwkUrl"
              placeholder="JWK Set URL*"
              required
              type="url"
            />
          </a-form-item>

          <a-form-item :rules="formRules.scopes" class="!mb-4" name="scopes">
            <NcSelect
              v-model:value="form.scopes"
              :options="[...['openid', 'profile', 'email'].map((s) => ({ label: s, value: s }))]"
              class="w-full"
              data-test-id="nc-oidc-scopes"
              mode="tags"
              placeholder="-scope not selected*-"
            />
          </a-form-item>

          <a-form-item :rules="formRules.userNameAttribute" name="userNameAttribute">
            <a-input
              v-model:value="form.userNameAttribute"
              class="mt-4"
              data-test-id="nc-oidc-user-attribute"
              placeholder="Username Attribute*"
              required
            />
          </a-form-item>

          <div
            class="flex rounded-lg mt-4 border-1 border-gray-200 bg-orange-50 p-4 justify-between"
            data-test-id="nc-oidc-sso-only"
          >
            <div class="flex gap-4">
              <component :is="iconMap.info" class="text-yellow-500 h-6 w-6" />
              <div>
                <div class="text-gray-800 mb-1 font-bold">Allow SSO Login only</div>
                <div class="text-gray-500">Enable SSO Logins only after testing metadata, by signing in using SSO.</div>
              </div>
            </div>

            <NcSwitch v-model:checked="form.ssoOnly" />
          </div>
        </a-form>
      </div>
    </div>
    <div class="flex justify-end gap-2 mt-4">
      <NcButton data-test-id="nc-oidc-cancel-btn" size="medium" type="secondary" @click="dialogShow = false">
        {{ $t('labels.cancel') }}
      </NcButton>
      <NcButton
        :disabled="isButtonDisabled"
        data-test-id="nc-oidc-save-btn"
        size="medium"
        type="primary"
        @click="saveOIDCProvider"
      >
        {{ $t('labels.save') }}
      </NcButton>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
.ant-input::placeholder {
  @apply text-gray-500;
}
.nc-select.ant-select .ant-select-selector {
  @apply !h-[45px];
}
.ant-input {
  @apply px-4 rounded-lg py-2 w-full border-1 focus:border-brand-500 border-gray-200 !ring-0;
}
</style>
