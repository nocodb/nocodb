<script setup lang="ts">
import { useAccountSetupStoreOrThrow } from '../../composables/useAccountSetupStore'

const { t } = useI18n()

const { loadSetupApps, emailConfigured, storageConfigured, listModalDlg } = useAccountSetupStoreOrThrow()

const { appInfo } = useGlobal()

const openedCategory = ref<string | null>(null)

const configs = computed(() => [
  {
    title: t('labels.setupLabel', { label: t('labels.email') }),
    key: 'email',
    description: 'Configure an email account to send system notifications to your organisation’s users.',
    docsLink: '',
    onClick: () => {
      // listModalDlg.value = true
      // openedCategory.value = 'Email'
      navigateTo(`/account/setup/email${emailConfigured.value ? `/${emailConfigured.value.title}` : ''}`)
    },
    configured: emailConfigured.value,
  },
  {
    title: t('labels.setupLabel', { label: t('labels.storage') }),
    key: 'storage',
    description: 'Configure a storage service to store your organisation’s data.',
    docsLink: '',
    onClick: () => {
      // listModalDlg.value = true
      // openedCategory.value = 'Storage'

      navigateTo(`/account/setup/storage${storageConfigured.value ? `/${storageConfigured.value.title}` : ''}`)
    },
    configured: storageConfigured.value,
  },
  {
    title: t('labels.switchToProd'),
    key: 'switchToProd',
    description: 'Configure a production-ready app database to port from the existing built-in application database.',
    docsLink: '',
    onClick: () => {
      //  TODO: Implement the logic to switch to production
    },
    isPending: !(appInfo.value as any)?.prodReady,
  },
])

onMounted(async () => {
  await loadSetupApps()
})
</script>

<template>
  <div class="flex flex-col" data-test-id="nc-setup">
    <NcPageHeader>
      <template #icon>
        <div class="flex justify-center items-center h-5 w-5">
          <GeneralIcon icon="ncSliders" class="flex-none text-[20px]" />
        </div>
      </template>
      <template #title>
        <span data-rec="true">
          {{ $t('labels.setup') }}
        </span>
      </template>
    </NcPageHeader>

    <div
      class="nc-content-max-w flex-1 max-h-[calc(100vh_-_100px)] overflow-y-auto nc-scrollbar-thin flex flex-col items-center gap-6 p-6"
    >
      <div class="flex flex-col gap-6 w-150">
        <div v-for="config of configs" class="flex flex-col border-1 rounded-2xl border-gray-200 p-6 gap-y-2">
          <div class="flex flex justify-between" data-rec="true">
            <span class="font-bold text-base"> {{ config.title }}</span>

            <NcTooltip v-if="!config.configured || config.isPending">
              <template #title>
                <span>
                  {{ $t('activity.pending') }}
                </span>
              </template>
              <GeneralIcon icon="warning" class="text-orange-500" />
            </NcTooltip>
          </div>
          <div class="text-gray-600 text-sm">{{ config.description }}</div>

          <div v-if="config.configured" class="flex justify-between mt-4 cursor-pointer" @click="config.onClick">
            <div class="flex gap-4 items-center border-1 w-full p-4 rounded-2xl">
              <GeneralIcon icon="circleCheckSolid" class="text-success w-6 h-6 bg-white-500" />
              <img
                v-if="config.configured.title !== 'SMTP'"
                class="max-h-6 max-w-6"
                :alt="config.configured.title"
                :style="{
                  backgroundColor: config.configured.title === 'SES' ? '#242f3e' : '',
                }"
                :src="config.configured.logo"
              />
              <GeneralIcon v-else icon="mail" />
              <span class="font-weight-bold text-base">{{ config.configured.title }}</span>
              <div class="flex-grow" />
              <NcButton type="text">
                <div class="flex gap-2 items-center">
                  <GeneralIcon icon="ncEdit3" />
                  Edit
                </div>
              </NcButton>
            </div>
          </div>
          <div v-else class="flex justify-between mt-4">
            <NcButton size="small" type="text">
              <div class="flex gap-2 items-center">
                Go to docs
                <GeneralIcon icon="ncExternalLink" />
              </div>
            </NcButton>
            <NcButton size="small" @click="config.onClick">Configure</NcButton>
          </div>
        </div>
      </div>
    </div>

    <LazyAccountSetupListModal v-if="openedCategory" v-model="listModalDlg" :category="openedCategory" />
  </div>
</template>

<style scoped lang="scss"></style>
