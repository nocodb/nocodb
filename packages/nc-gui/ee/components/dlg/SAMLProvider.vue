<script lang="ts" setup>
import type { SSOClientType } from 'nocodb-sdk'
import type { RuleObject } from 'ant-design-vue/es/form'
import isURL from 'validator/lib/isURL'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    isEdit: boolean
    saml: SSOClientType
    isOrg?: boolean
    isWorkspace?: boolean
  }>(),
  {
    saml: () => ({}),
  },
)

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const { addProvider, updateProvider, getRedirectUrl, getEntityId } = useAuthentication(props.isOrg, props.isWorkspace)

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
  xml: [
    {
      validator: (rule, value, callback) => {
        if (!form.metaDataUrl && !value) {
          return callback(t('msg.error.eitherXML'))
        }
        return callback()
      },
    },
  ] as RuleObject[],

  metaDataUrl: [
    {
      validator: (rule, value, callback) => {
        if (!form.xml && !value && !isURL(value, { require_tld: false })) {
          return callback(t('msg.error.eitherXML'))
        }

        return callback()
      },
    },
  ] as RuleObject[],
}

const formValidator = ref()

const { copy } = useCopy()

const activeTabKey = ref('metaDataURL')

const dialogShow = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const isCopied = ref({
  redirectUrl: false,
  entityId: false,
})

const copyRedirectUrl = async (redirectUrl: string) => {
  await copy(redirectUrl)
  isCopied.value.redirectUrl = true
}

const copyEntityId = async (entityId: string) => {
  await copy(entityId)
  isCopied.value.entityId = true
}

const isButtonDisabled = computed(() => {
  if (form.metaDataUrl) return !isURL(form.metaDataUrl, { require_tld: false })
  return !form.xml
})

watch(isCopied.value, (v) => {
  if (v.redirectUrl) {
    setTimeout(() => {
      isCopied.value.redirectUrl = false
    }, 2000)
  }
  if (v.entityId) {
    setTimeout(() => {
      isCopied.value.entityId = false
    }, 2000)
  }
})

const saveSamlProvider = async () => {
  try {
    await formValidator.value.validate()
  } catch (e) {
    console.log(e)
    return
  }

  const isXMLorMetaDataUrlValid = () => {
    if (form.metaDataUrl) return isURL(form.metaDataUrl, { require_tld: false })
    return !!form.xml
  }
  if (!isXMLorMetaDataUrlValid()) return
  if (props.isEdit) {
    const res = await updateProvider(props.saml.id, {
      title: form.title,
      config: {
        metaDataUrl: form.metaDataUrl,
        xml: form.xml,
        ssoOnly: form.ssoOnly,
      },
    })
    if (res) {
      dialogShow.value = false
    }
    return
  }
  const res = await addProvider({
    type: 'saml',
    title: form.title,
    config: {
      metaDataUrl: form.metaDataUrl,
      xml: form.xml,
      ssoOnly: form.ssoOnly,
    },
  })
  if (res) {
    dialogShow.value = false
  }
}
</script>

<template>
  <NcModal v-model:visible="dialogShow" class="nc-saml-modal" data-test-id="nc-saml-modal" @keydown.esc="dialogShow = false">
    <div class="font-bold mb-4 text-base">{{ $t('activity.registerSAML') }}</div>
    <div class="overflow-y-auto max-h-[90vh] pr-1 nc-scrollbar-md">
      <div class="gap-y-8 flex flex-col">
        <a-form ref="formValidator" :model="form">
          <a-form-item :rules="formRules.title" name="title">
            <a-input v-model:value="form.title" data-test-id="nc-saml-title" placeholder="SAML Display Name*" />
          </a-form-item>

          <div class="flex flex-col gap-2">
            <div class="flex flex-row items-center">
              <span class="text-nc-content-gray">{{ $t('labels.redirectUrl') }}</span>
              <NcTooltip>
                <template #title>
                  This is the URL where authentication responses will be sent after successful login. Also referred to as
                  'Callback URL' or 'Reply URL'.
                </template>
                <div class="h-full flex align-center">
                  <component :is="iconMap.info" class="ml-2 text-nc-content-gray-muted text-xs" />
                </div>
              </NcTooltip>
            </div>
            <div
              class="flex border-nc-border-gray-medium border-1 bg-nc-bg-gray-extralight items-center justify-between py-2 px-4 rounded-lg"
            >
              <span
                class="text-nc-content-gray overflow-hidden overflow-ellipsis whitespace-nowrap mr-2 flex-grow"
                data-test-id="nc-saml-redirect-url"
              >
                {{ getRedirectUrl(saml) }}
              </span>
              <NcButton size="xsmall" type="text" @click="copyRedirectUrl(getRedirectUrl(saml))">
                <MdiCheck v-if="isCopied.redirectUrl" class="h-3.5" />
                <component :is="iconMap.copy" v-else class="text-nc-content-gray" />
              </NcButton>
            </div>
            <span class="text-xs text-nc-content-gray-muted">{{ $t('msg.info.idpPaste') }}</span>
          </div>
          <div class="flex flex-col my-8 gap-2">
            <div class="flex flex-row items-center">
              <span class="text-nc-content-gray">{{ $t('labels.audience-entityId') }}</span>
              <NcTooltip>
                <template #title>
                  This is the unique identifier for your application that is expected by the Identity Provider (IDP). It helps the
                  IDP recognise and validate tokens issued specifically for your application.
                </template>
                <div class="h-full flex align-center">
                  <component :is="iconMap.info" class="ml-2 text-nc-content-gray-muted text-xs" />
                </div>
              </NcTooltip>
            </div>
            <div
              class="flex border-nc-border-gray-medium border-1 bg-nc-bg-gray-extralight items-center justify-between py-2 px-4 rounded-lg"
            >
              <span
                class="text-nc-content-gray overflow-hidden overflow-ellipsis whitespace-nowrap mr-2 flex-grow"
                data-test-id="nc-saml-issuer-url"
              >
                {{ getEntityId(saml) }}
              </span>
              <NcButton size="xsmall" type="text" @click="copyEntityId(getEntityId(saml))">
                <MdiCheck v-if="isCopied.entityId" class="h-3.5" />
                <component :is="iconMap.copy" v-else class="text-nc-content-gray" />
              </NcButton>
            </div>
            <span class="text-xs text-nc-content-gray-muted">{{ $t('msg.info.idpPaste') }}</span>
          </div>

          <a-tabs v-model:active-key="activeTabKey" class="!pl-0 min-h-53">
            <a-tab-pane key="metaDataURL">
              <template #tab>
                <div data-test-id="nc-saml-metadata-url-tab" class="text-sm">{{ $t('labels.metadataUrl') }}</div>
              </template>
              <a-form-item :rules="formRules.metaDataUrl" name="metaDataUrl">
                <a-input
                  v-model:value="form.metaDataUrl"
                  data-test-id="nc-saml-metadata-url"
                  placeholder="Paste the Metadata URL here from the Identity Provider"
                />
                <div class="text-sm text-nc-content-gray-muted mt-2">Metadata will be fetched from URL and saved as XML</div>
              </a-form-item>
            </a-tab-pane>
            <a-tab-pane key="xml">
              <template #tab>
                <div data-test-id="nc-saml-xml-tab" class="text-sm">XML</div>
              </template>
              <a-form-item :rules="formRules.xml" name="xml">
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
          <!-- Disable since SSO only option is implemented at the moment -->
          <!-- <div class="flex rounded-lg mt-4 border-1 border-nc-border-gray-medium bg-nc-bg-orange-light p-4 justify-between">
                <div class="flex gap-4">
                  <component :is="iconMap.info" class="text-nc-content-yellow-medium h-6 w-6" />
                  <div>
                    <div class="text-nc-content-gray mb-1 font-bold">Allow SSO Login only</div>
                    <div class="text-nc-content-gray-muted">Enable SSO Logins only after testing metadata, by signing in using SSO.</div>
                  </div>
                </div>

                <NcSwitch v-model:checked="form.ssoOnly" />
              </div>
          -->
        </a-form>
      </div>
    </div>
    <div class="flex justify-end gap-2 mt-8">
      <NcButton size="medium" type="secondary" @click="dialogShow = false">
        {{ $t('labels.cancel') }}
      </NcButton>
      <NcButton :disabled="isButtonDisabled" data-test-id="nc-saml-submit" size="medium" type="primary" @click="saveSamlProvider">
        {{ $t('labels.save') }}
      </NcButton>
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-saml-modal {
  @apply !max-h-[90vh];

  .nc-modal {
    @apply !max-h-[90vh];
  }

  .ant-input::placeholder {
    @apply text-nc-content-gray-muted;
  }

  .ant-input {
    @apply px-4 rounded-lg py-2 w-full border-1 focus:border-nc-border-brand border-nc-border-gray-medium !ring-0;
  }
}
</style>
