<script lang="ts" setup>
import type { SSOClientType } from 'nocodb-sdk'

const { fetchProviders, providers, deleteProvider, updateProvider, addProvider, getPrePopulatedProvider, signInUrl } =
  useAuthentication()

const samlProviders = computed(() => {
  return [...providers.value].filter((provider: SSOClientType) => provider.type === 'saml')
})

const oidcProviders = computed(() => {
  return [...providers.value].filter((provider: SSOClientType) => provider.type === 'oidc')
})

const samlDialogShow = ref(false)
const oidcDialogShow = ref(false)

const isEdit = ref(false)

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

const updateProviderStatus = async (client: { enabled: boolean }) => {
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

const enableEdit = (provider: SSOClientType) => {
  isEdit.value = true
  providerProp.value = provider
  if (provider.type === 'saml') {
    samlDialogShow.value = true
  } else {
    oidcDialogShow.value = true
  }
}

onMounted(async () => {
  await fetchProviders()
})
</script>

<template>
  <div class="flex flex-col items-center" data-test-id="nc-authentication">
    <div class="flex flex-col w-150">
      <div class="flex justify-between items-center" data-rec="true">
        <span class="font-bold text-xl">
          {{ $t('labels.ssoSettings') }}
        </span>
        <a class="!text-gray-700 !hover:text-gray-700"> Go to documentation </a>
      </div>
      <div class="mt-5 flex flex-col border-1 rounded-2xl border-gray-200 p-6 gap-y-2">
        <div class="flex font-bold text-base" data-rec="true">{{ $t('labels.generalSettings') }}</div>
        <div class="">
          <h1 class="text-md text-gray-800">SignIn URL</h1>
          <div class="flex border-gray-200 border-1 bg-gray-50 items-center justify-between py-2 px-4 rounded-lg">
            <span class="text-gray-800"> {{ signInUrl }} </span>
            <NcButton
              size="xsmall"
              type="text"
              @click="copy(signInUrl)"
            >
              <component :is="iconMap.copy" class="text-gray-800" />
            </NcButton>
          </div>
        </div>
      </div>
      <div class="mt-5 flex flex-col border-1 rounded-2xl border-gray-200 p-6">
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
        <a-divider class="text-gray-200" />
        <div class="flex flex-col">
          <span v-if="!samlProviders.length" class="text-gray-500"> {{ $t('msg.info.noSaml') }} </span>
          <div
            v-for="(sam, id) in samlProviders"
            :key="id"
            :data-test-id="`nc-saml-provider-${sam.title}`"
            class="flex flex-row justify-between nc-saml-provider w-full items-center p-3 hover:bg-gray-50 first:rounded-t-lg border-b-1 first:border-t-1 border-x-1 last:rounded-b-lg cursor-pointer group text-gray-600"
          >
            <div :class="`nc-saml-${sam.title}-enable`">
              <NcSwitch :checked="!!sam.enabled" class="min-w-4" size="small" @change="updateProviderStatus(sam)" />
              <span class="text-inherit ml-2 group-hover:text-black capitalize" data-test-id="nc-saml-title">
                {{ sam?.title }}
              </span>
            </div>

            <NcDropdown :trigger="['click']" overlay-class-name="!rounded-md">
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
                  <NcMenuItem data-test-id="nc-saml-duplicate" @click="duplicateProvider(sam.id)">
                    <div class="flex flex-row items-center">
                      <component :is="iconMap.copy" class="text-gray-800" />
                      <span class="text-gray-800 ml-2"> {{ $t('general.duplicate') }} </span>
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
      <div class="mt-5 flex flex-col border-1 rounded-2xl border-gray-200 p-6" data-test-id="nc-oidc-provider">
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
        <a-divider class="text-gray-200" />
        <div class="flex flex-col">
          <span v-if="!oidcProviders.length" class="text-gray-500"> {{ $t('msg.info.noSaml') }} </span>
          <div
            v-for="(oid, id) in oidcProviders"
            :key="id"
            :data-test-id="`nc-oidc-provider-${oid.name}`"
            class="flex flex-row nc-oidc-provider justify-between w-full items-center p-3 hover:bg-gray-50 first:rounded-t-lg border-b-1 first:border-t-1 border-x-1 last:rounded-b-lg cursor-pointer group text-gray-600"
          >
            <div :class="`nc-oidc-${oid.title}-enable`">
              <NcSwitch :checked="!!oid.enabled" class="min-w-4" size="small" @change="updateProviderStatus(oid)" />
              <span class="text-inherit ml-2 group-hover:text-black capitalize" data-test-id="nc-oidc-title">
                {{ oid?.title }}
              </span>
            </div>

            <NcDropdown :trigger="['click']" overlay-class-name="!rounded-md">
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
                  <NcMenuItem data-test-id="nc-oidc-duplicate" @click="duplicateProvider(oid.id)">
                    <div class="flex flex-row items-center">
                      <component :is="iconMap.copy" class="text-gray-800" />
                      <span class="text-gray-800 ml-2"> {{ $t('general.duplicate') }} </span>
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
    <DlgSAMLProvider v-if="samlDialogShow" v-model:model-value="samlDialogShow" :is-edit="isEdit" :saml="providerProp" />
    <DlgOIDCProvider v-if="oidcDialogShow" v-model:model-value="oidcDialogShow" :is-edit="isEdit" :oidc="providerProp" />
  </div>
</template>

<style lang="scss" scoped></style>
