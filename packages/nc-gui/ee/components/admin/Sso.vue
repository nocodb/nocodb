<script lang="ts" setup>
import type { SSOClientType } from 'nocodb-sdk'

const { org } = storeToRefs(useOrg())

const { fetchProviders, providers, deleteProvider, updateProvider, addProvider, getPrePopulatedProvider, signInUrl } =
  useAuthentication(true)

const samlProviders = computed(() => {
  return [...providers.value].filter((provider: SSOClientType) => provider.type === 'saml' && !provider.deleted)
})

const oidcProviders = computed(() => {
  return [...providers.value].filter((provider: SSOClientType) => provider.type === 'oidc' && !provider.deleted)
})

const samlDialogShow = ref(false)
const oidcDialogShow = ref(false)

const isEdit = ref(false)

const isCopied = ref({
  signIn: false,
})

const providerProp = ref<SSOClientType>()

const addSamlProvider = async () => {
  samlDialogShow.value = true
  isEdit.value = true
  providerProp.value = await getPrePopulatedProvider('saml')
}
const addOIDCProvider = async () => {
  oidcDialogShow.value = true
  isEdit.value = true
  providerProp.value = await getPrePopulatedProvider('oidc')
}

const { copy } = useCopy()

const copySigninUrl = async () => {
  await copy(signInUrl.value)
  isCopied.value.signIn = true
}

const updateProviderStatus = async (client: { enabled: boolean; id: string }) => {
  if (!client.id) {
    // googleDialogShow.value = true
    isEdit.value = true
    providerProp.value = await getPrePopulatedProvider('google')
    return
  }
  client.enabled = !client.enabled
  await updateProvider(client.id, { enabled: client.enabled })
}

watch(
  () => samlDialogShow.value,
  async (v) => {
    if (!v) {
      isEdit.value = false
      providerProp.value = undefined
      await fetchProviders()
    }
  },
)

watch(isCopied.value, (v) => {
  if (v.signIn) {
    console.log('copied')
    setTimeout(() => {
      isCopied.value.signIn = false
    }, 2000)
  }
})

watch(
  () => oidcDialogShow.value,
  async (v) => {
    if (!v) {
      isEdit.value = false
      providerProp.value = undefined
      await fetchProviders()
    }
  },
)

const duplicateProvider = async (id: string) => {
  const provider = providers.value.find((p) => p.id === id)
  if (provider) {
    delete provider.id
    await addProvider(provider)
  }
}

const enableEdit = async (provider: SSOClientType) => {
  isEdit.value = true
  if (provider.type === 'saml') {
    providerProp.value = provider
    samlDialogShow.value = true
  } else if (provider.type === 'oidc') {
    providerProp.value = provider
    oidcDialogShow.value = true
  }
}

onMounted(async () => {
  await fetchProviders()
})
</script>

<template>
  <div class="flex flex-col" data-test-id="nc-authentication">
    <div class="nc-breadcrumb px-2">
      <div class="nc-breadcrumb-item">
        {{ org.title }}
      </div>
      <GeneralIcon icon="ncSlash1" class="nc-breadcrumb-divider" />
      <div class="nc-breadcrumb-item active">
        {{ $t('labels.authentication') }}
      </div>
    </div>
    <NcPageHeader>
      <template #icon>
        <div class="flex justify-center items-center h-5 w-5">
          <GeneralIcon icon="lock" class="flex-none text-[20px]" />
        </div>
      </template>
      <template #title>
        <span data-rec="true">
          {{ $t('labels.authentication') }}
        </span>
      </template>
    </NcPageHeader>

    <div
      class="flex-1 max-h-[calc(100vh_-_100px)] overflow-y-auto nc-scrollbar-thin flex flex-col items-center gap-6 p-6 border-t-1 border-gray-200"
    >
      <div class="flex flex-col gap-6 w-150">
        <div class="flex justify-between items-center" data-rec="true">
          <span class="font-bold text-xl"> SSO </span>
          <a class="!text-gray-700 !hover:text-gray-700"> Go to documentation </a>
        </div>

        <AdminDomains />

        <div class="flex flex-col border-1 rounded-2xl border-gray-200 p-6 gap-y-2">
          <div class="flex font-bold text-base" data-rec="true">{{ $t('labels.generalSettings') }}</div>
          <div class="">
            <h1 class="text-md text-gray-800">SignIn URL</h1>
            <div class="flex border-gray-200 border-1 bg-gray-50 items-center justify-between py-2 px-4 rounded-lg">
              <span class="text-gray-800"> {{ signInUrl }} </span>
              <NcButton size="xsmall" type="text" @click="copySigninUrl">
                <MdiCheck v-if="isCopied.signIn" class="h-3.5" />
                <component :is="iconMap.copy" v-else class="text-gray-800" />
              </NcButton>
            </div>
          </div>
        </div>

        <div class="flex flex-col border-1 rounded-2xl border-gray-200 p-6">
          <div class="flex font-bold justify-between text-base" data-rec="true">
            {{ $t('labels.saml') }}

            <NcButton
              :disabled="samlProviders.length >= 1"
              data-test-id="nc-new-saml-provider"
              size="small"
              type="secondary"
              @click="addSamlProvider"
            >
              <component :is="iconMap.plus" />
              <span> {{ $t('labels.newProvider') }} </span>
            </NcButton>
          </div>
          <div class="flex flex-col">
            <span v-if="!samlProviders.length" class="text-gray-500"> {{ $t('msg.info.noSaml') }} </span>
            <div
              v-for="(sam, id) in samlProviders"
              :key="id"
              :data-test-id="`nc-saml-provider-${sam.title}`"
              class="flex flex-row justify-between nc-saml-provider w-full items-center p-3 hover:bg-gray-50 first:rounded-t-lg border-b-1 first:border-t-1 border-x-1 last:rounded-b-lg cursor-pointer group text-gray-600"
              @click="enableEdit(sam)"
            >
              <div :class="`nc-saml-${sam.title}-enable`">
                <span @click.stop>
                  <NcSwitch :checked="!!sam.enabled" class="min-w-4" size="small" @change="updateProviderStatus(sam)" />
                </span>
                <span class="text-inherit ml-2 group-hover:text-black capitalize" data-test-id="nc-saml-title">
                  {{ sam?.title }}
                </span>
              </div>

              <NcDropdown :trigger="['click']" overlay-class-name="!rounded-md" @click.stop>
                <NcButton
                  :class="`nc-saml-${sam.title}-more-option`"
                  class="!text-gray-500 !hover:text-gray-800"
                  data-test-id="nc-saml-more-option"
                  size="xsmall"
                  type="text"
                >
                  <GeneralIcon class="text-inherit" icon="threeDotVertical" />
                </NcButton>
                <template #overlay>
                  <NcMenu>
                    <NcMenuItem data-test-id="nc-saml-edit" @click="enableEdit(sam)">
                      <div class="flex flex-row items-center">
                        <component :is="iconMap.edit" class="text-gray-800" />
                        <span class="text-gray-800 ml-2"> {{ $t('general.edit') }} </span>
                      </div>
                    </NcMenuItem>
                    <NcMenuItem class="!hover:bg-white !cursor-not-allowed" data-test-id="nc-saml-duplicate">
                      <div class="flex flex-row items-center">
                        <component :is="iconMap.copy" class="text-gray-400" />
                        <span class="text-gray-400 ml-2"> {{ $t('general.duplicate') }} </span>
                      </div>
                    </NcMenuItem>
                    <a-menu-divider class="my-1.5" />
                    <NcMenuItem data-test-id="nc-saml-delete" @click="deleteProvider(sam.id)">
                      <div class="text-red-500">
                        <GeneralIcon class="group-hover:text-accent -ml-0.25 -mt-0.75 mr-0.5" icon="delete" />
                        {{ $t('general.delete') }}
                      </div>
                    </NcMenuItem>
                  </NcMenu>
                </template>
              </NcDropdown>
            </div>
          </div>
        </div>
        <div class="flex flex-col border-1 rounded-2xl border-gray-200 p-6" data-test-id="nc-oidc-provider">
          <div class="flex font-bold justify-between text-base" data-rec="true">
            {{ $t('labels.oidc') }}

            <NcButton
              :disabled="oidcProviders.length >= 1"
              data-test-id="nc-new-oidc-provider"
              size="small"
              type="secondary"
              @click="addOIDCProvider"
            >
              <component :is="iconMap.plus" />
              <span> {{ $t('labels.newProvider') }} </span>
            </NcButton>
          </div>
          <div class="flex flex-col">
            <span v-if="!oidcProviders.length" class="text-gray-500"> {{ $t('msg.info.noOIDC') }} </span>
            <div
              v-for="oid in oidcProviders"
              :key="oid.id"
              :data-test-id="`nc-oidc-provider-${oid.title}`"
              class="flex flex-row nc-oidc-provider justify-between w-full items-center p-3 hover:bg-gray-50 first:rounded-t-lg border-b-1 first:border-t-1 border-x-1 last:rounded-b-lg cursor-pointer group text-gray-600"
              @click="enableEdit(oid)"
            >
              <div :class="`nc-oidc-${oid.title}-enable`">
                <span @click.stop>
                  <NcSwitch :checked="!!oid.enabled" class="min-w-4" size="small" @change="updateProviderStatus(oid)" />
                </span>
                <span class="text-inherit ml-2 group-hover:text-black capitalize" data-test-id="nc-oidc-title">
                  {{ oid?.title }}
                </span>
              </div>

              <NcDropdown :trigger="['click']" overlay-class-name="!rounded-md" @click.stop>
                <NcButton
                  :class="`nc-oidc-${oid.title}-more-option`"
                  class="!text-gray-500 !hover:text-gray-800"
                  data-test-id="nc-oidc-more-option"
                  size="xsmall"
                  type="text"
                >
                  <GeneralIcon class="text-inherit" icon="threeDotVertical" />
                </NcButton>
                <template #overlay>
                  <NcMenu>
                    <NcMenuItem data-test-id="nc-oidc-edit" @click="enableEdit(oid)">
                      <div class="flex flex-row items-center">
                        <component :is="iconMap.edit" class="text-gray-800" />
                        <span class="text-gray-800 ml-2"> {{ $t('general.edit') }} </span>
                      </div>
                    </NcMenuItem>
                    <NcMenuItem
                      class="!hover:bg-white !cursor-not-allowed"
                      data-test-id="nc-oidc-duplicate"
                      @click="duplicateProvider(oid.id)"
                    >
                      <div class="flex flex-row items-center">
                        <component :is="iconMap.copy" class="text-gray-400" />
                        <span class="text-gray-400 ml-2"> {{ $t('general.duplicate') }} </span>
                      </div>
                    </NcMenuItem>
                    <a-menu-divider class="my-1.5" />
                    <NcMenuItem data-test-id="nc-oidc-delete" @click="deleteProvider(oid.id)">
                      <div class="text-red-500">
                        <GeneralIcon class="group-hover:text-accent -ml-0.25 -mt-0.75 mr-0.5" icon="delete" />
                        {{ $t('general.delete') }}
                      </div>
                    </NcMenuItem>
                  </NcMenu>
                </template>
              </NcDropdown>
            </div>
          </div>
        </div>
      </div>
      <!--    <DlgGoogleProvider
      v-if="googleDialogShow"
      v-model:model-value="googleDialogShow"
      is-org
      :google="providerProp"
      :is-edit="isEdit"
    /> -->
      <DlgSAMLProvider v-if="samlDialogShow" v-model:model-value="samlDialogShow" is-org :is-edit="isEdit" :saml="providerProp" />
      <DlgOIDCProvider v-if="oidcDialogShow" v-model:model-value="oidcDialogShow" is-org :is-edit="isEdit" :oidc="providerProp" />
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
