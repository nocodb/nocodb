<script lang="ts" setup>
import type { SSOClientType } from 'nocodb-sdk'

const { fetchProviders, providers, deleteProvider, updateProvider, addProvider } = useAuthentication()

const samlProviders = computed(() => {
  return providers.value.filter((provider) => provider.type === 'saml')
})

const oidcProviders = computed(() => {
  return providers.value.filter((provider) => provider.type === 'oidc')
})

const samlDialogShow = ref(false)
const oidcDialogShow = ref(false)

const addSamlProvider = () => {
  samlDialogShow.value = true
}
const addOIDCProvider = () => {
  oidcDialogShow.value = true
}

const providerProp = ref<SSOClientType>()

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text)
}

const updateProviderStatus = async (id: string, enabled: boolean) => {
  await updateProvider(id, { enabled })
}

watch(samlDialogShow, () => {
  if (samlDialogShow.value) {
    providerProp.value = {
      type: 'saml',
      title: '',
      config: {
        metaDataUrl: '',
        xml: '',
        ssoOnly: false,
      },
    }
  } else {
    providerProp.value = {}
  }
})

watch(oidcDialogShow, () => {
  if (oidcDialogShow.value) {
    providerProp.value = {
      type: 'oidc',
      title: '',
      config: {
        clientId: '',
        clientSecret: '',
        redirectUrl: '',
        authUrl: '',
        tokenUrl: '',
        userInfoUrl: '',
        ssoOnly: false,
      },
    }
  } else {
    providerProp.value = {}
  }
})

const duplicateProvider = async (id: string) => {
  console.log('duplicateProvider', id)
  const provider = providers.value.find((p) => p.id === id)
  if (provider) {
    delete provider.id
    await addProvider(provider)
  }
}

onMounted(async () => {
  await fetchProviders()
})
</script>

<template>
  <div class="flex flex-col items-center">
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
            <span class="text-gray-800"> https://idp.example.com/example_login/accounting_team_alhvd8WO </span>
            <NcButton
              size="xsmall"
              type="text"
              @click="
                () => {
                  copyToClipboard('https://idp.example.com/example_login/accounting_team_alhvd8WO')
                }
              "
            >
              <component :is="iconMap.copy" class="text-gray-800" />
            </NcButton>
          </div>
        </div>
      </div>
      <div class="mt-5 flex flex-col border-1 rounded-2xl border-gray-200 p-6">
        <div class="flex font-bold justify-between text-base" data-rec="true">
          {{ $t('labels.saml') }}

          <NcButton size="small" type="secondary" @click="addSamlProvider">
            <component :is="iconMap.plus" class="text-gray-800" />
            <span class="text-gray-800"> {{ $t('labels.newProvider') }} </span>
          </NcButton>
        </div>
        <a-divider class="text-gray-200" />
        <div class="flex flex-col">
          <span v-if="!samlProviders.length" class="text-gray-500"> {{ $t('msg.info.noSaml') }} </span>
          <div
            v-for="(sam, id) in samlProviders"
            :key="id"
            class="flex flex-row justify-between w-full items-center p-3 hover:bg-gray-50 first:rounded-t-lg border-b-1 first:border-t-1 border-x-1 last:rounded-b-lg cursor-pointer group text-gray-600"
          >
            <div>
              <NcSwitch
                :checked="sam.enabled"
                class="min-w-4"
                size="small"
                @change="updateProviderStatus(sam.id, !sam.enabled)"
              />
              <span class="text-inherit ml-2 group-hover:text-black capitalize">
                {{ sam?.title }}
              </span>
            </div>

            <NcDropdown :trigger="['click']" overlay-class-name="!rounded-md">
              <NcButton class="!text-gray-500 !hover:text-gray-800" size="xsmall" type="text">
                <GeneralIcon class="text-inherit" icon="threeDotVertical" />
              </NcButton>
              <template #overlay>
                <NcMenu>
                  <NcMenuItem>
                    <div class="flex flex-row items-center">
                      <component :is="iconMap.edit" class="text-gray-800" />
                      <span class="text-gray-800 ml-2"> {{ $t('general.edit') }} </span>
                    </div>
                  </NcMenuItem>
                  <NcMenuItem @click="duplicateProvider(sam.id)">
                    <div class="flex flex-row items-center">
                      <component :is="iconMap.copy" class="text-gray-800" />
                      <span class="text-gray-800 ml-2"> {{ $t('general.duplicate') }} </span>
                    </div>
                  </NcMenuItem>
                  <a-menu-divider class="my-1.5" />
                  <NcMenuItem @click="deleteProvider(sam.id)">
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
      <div class="mt-5 flex flex-col border-1 rounded-2xl border-gray-200 p-6">
        <div class="flex font-bold justify-between text-base" data-rec="true">
          {{ $t('labels.oidc') }}

          <NcButton size="small" type="secondary" @click="addOIDCProvider">
            <component :is="iconMap.plus" class="text-gray-800" />
            <span class="text-gray-800"> {{ $t('labels.newProvider') }} </span>
          </NcButton>
        </div>
        <a-divider class="text-gray-200" />
        <div class="flex flex-col">
          <span v-if="!oidcProviders.length" class="text-gray-500"> {{ $t('msg.info.noSaml') }} </span>
          <div
            v-for="(oid, id) in oidcProviders"
            :key="id"
            class="flex flex-row justify-between w-full items-center p-3 hover:bg-gray-50 first:rounded-t-lg border-b-1 first:border-t-1 border-x-1 last:rounded-b-lg cursor-pointer group text-gray-600"
          >
            <div>
              <NcSwitch :checked="oid.enabled" class="min-w-4" size="small" @click="(val) => {}" />
              <span class="text-inherit ml-2 group-hover:text-black capitalize">
                {{ oid?.title }}
              </span>
            </div>

            <NcDropdown :trigger="['click']" overlay-class-name="!rounded-md">
              <NcButton class="!text-gray-500 !hover:text-gray-800" size="xsmall" type="text">
                <GeneralIcon class="text-inherit" icon="threeDotVertical" />
              </NcButton>
              <template #overlay>
                <NcMenu>
                  <NcMenuItem>
                    <div class="flex flex-row items-center">
                      <component :is="iconMap.edit" class="text-gray-800" />
                      <span class="text-gray-800 ml-2"> {{ $t('general.edit') }} </span>
                    </div>
                  </NcMenuItem>
                  <NcMenuItem @click="duplicateProvider(oid.id)">
                    <div class="flex flex-row items-center">
                      <component :is="iconMap.copy" class="text-gray-800" />
                      <span class="text-gray-800 ml-2"> {{ $t('general.duplicate') }} </span>
                    </div>
                  </NcMenuItem>
                  <a-menu-divider class="my-1.5" />
                  <NcMenuItem @click="deleteProvider(oid.id)">
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
    <DlgSAMLProvider v-model:model-value="samlDialogShow" :saml="providerProp" />
    <DlgOIDCProvider v-model:model-value="oidcDialogShow" :oidc="providerProp" />
  </div>
</template>

<style lang="scss" scoped></style>
