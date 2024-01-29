<script lang="ts" setup>
import type { SSOClientType } from 'nocodb-sdk'
import type { RuleObject } from 'ant-design-vue/es/form'
import isURL from 'validator/lib/isURL'
import { computed, reactive, ref, useAuthentication, useCopy } from '#imports'

const props = defineProps<{
  modelValue: boolean
  isEdit: boolean
  saml: SSOClientType
}>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const { addProvider, updateProvider, getRedirectUrl, getEntityId } = useAuthentication()

const form = reactive<{ title: string; metaDataUrl?: string; xml?: string; ssoOnly: boolean }>({
  title: props.saml?.title ?? '',
  metaDataUrl: '',
  xml: props.saml?.config?.xml ?? '',
  ssoOnly: props.saml?.config?.ssoOnly ?? false,
})

const formRules = {
  title: [
    // Title is required
    { required: true, message: t('msg.error.nameRequired') },
  ] as RuleObject[],
  // Either metaDataUrl or xml is required
}

const formValidator = ref()

const { copy } = useCopy()

const activeTabKey = ref('metaDataURL')

const dialogShow = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const saveSamlProvider = async () => {
  const isValid = await formValidator.value.validate()

  const isXMLorMetaDataUrlValid = () => {
    if (form.metaDataUrl) return isURL(form.metaDataUrl, { require_tld: false })
    return !!form.xml
  }
  if (!isValid || !isXMLorMetaDataUrlValid()) return
  if (props.isEdit) {
    await updateProvider(props.saml.id, {
      title: form.title,
      config: {
        metaDataUrl: form.metaDataUrl,
        xml: form.xml,
        redirectUrl: '',
        ssoOnly: form.ssoOnly,
      },
    })
    dialogShow.value = false
    return
  }
  await addProvider({
    type: 'saml',
    title: form.title,
    config: {
      metaDataUrl: form.metaDataUrl,
      xml: form.xml,
      redirectUrl: '',
      ssoOnly: form.ssoOnly,
    },
  })
  dialogShow.value = false
}
</script>

<template>
  <NcModal v-model:visible="dialogShow" class="nc-saml-modal" data-test-id="nc-saml-modal" @keydown.esc="dialogShow = false">
    <div class="font-bold mb-4 text-base">{{ $t('activity.registerSAML') }}</div>
    <div class="overflow-y-auto h-[calc(min(40vh, 56rem))] pr-1 nc-scrollbar-md">
      <div class="gap-y-8 flex flex-col">
        <a-form ref="formValidator" :model="form">
          <a-form-item :rules="formRules.title" name="title">
            <a-input v-model:value="form.title" data-test-id="nc-saml-title" placeholder="SAML Display Name*" />
          </a-form-item>

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
                {{ getRedirectUrl(saml) }}
              </span>
              <NcButton size="xsmall" type="text" @click="copy(getRedirectUrl(saml))">
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
                <!-- Get Entity ID from Authentication Composable -->

                {{ getEntityId(saml) }}
              </span>
              <NcButton size="xsmall" type="text" @click="copy(getEntityId(saml))">
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
              <a-form-item name="metaDataUrl">
                <a-input
                  v-model:value="form.metaDataUrl"
                  data-test-id="nc-saml-metadata-url"
                  placeholder="Paste the Metadata URL here from the Identity Provider"
                />
              </a-form-item>
            </a-tab-pane>
            <a-tab-pane key="xml">
              <template #tab>
                <div class="text-sm">XML</div>
              </template>
              <a-form-item name="xml">
                <a-textarea
                  v-model:value="form.xml"
                  :auto-size="{
                    minRows: 5,
                    maxRows: 5,
                  }"
                  data-test-id="nc-saml-xml"
                  placeholder="Paste the Metadata here from the Identity Provider"
                />
              </a-form-item>
            </a-tab-pane>
          </a-tabs>

          <div class="flex rounded-lg mt-4 border-1 border-gray-200 bg-orange-50 p-4 justify-between">
            <div class="flex gap-4">
              <component :is="iconMap.info" class="text-yellow-500 h-6 w-6" />
              <div>
                <div class="text-gray-800 mb-1 font-bold">Allow SSO Log In only</div>
                <div class="text-gray-500">Enable SSO Logins only after testing metadata, by signing in using SSO.</div>
              </div>
            </div>

            <NcSwitch v-model:checked="form.ssoOnly" />
          </div>
          <div class="flex justify-end gap-2 mt-8">
            <NcButton size="medium" type="secondary" @click="dialogShow = false">
              {{ $t('labels.cancel') }}
            </NcButton>
            <NcButton data-test-id="nc-saml-submit" size="medium" type="primary" @click="saveSamlProvider">
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
