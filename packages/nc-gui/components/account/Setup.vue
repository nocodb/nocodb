<script setup lang="ts">
const { t } = useI18n()

const { loadSetupApps, emailConfigured, storageConfigured, listModalDlg } = useAccountSetupStoreOrThrow()

// const { appInfo } = useGlobal()

const openedCategory = ref<string | null>(null)

const configs = computed(() => [
  {
    title: t('labels.configLabel', { label: t('labels.email') }),
    key: 'email',
    description:
      'Configure your preferred email service to manage how your application sends alerts, notifications and other essential emails.',
    docsLink: 'https://docs.nocodb.com/account-settings/oss-specific-details#configure-email',
    buttonClick: () => {
      navigateTo(`/account/setup/email${emailConfigured.value ? `/${emailConfigured.value.title}` : ''}`)
    },
    itemClick: () => {
      navigateTo(`/account/setup/email`)
    },
    configured: emailConfigured.value,
  },
  {
    title: t('labels.configLabel', { label: t('labels.storage') }),
    key: 'storage',
    description: 'Set up and manage your preferred storage solution for securely handling and storing your application’s data.',
    docsLink: 'https://docs.nocodb.com/account-settings/oss-specific-details#configure-storage',
    buttonClick: () => {
      navigateTo(`/account/setup/storage${storageConfigured.value ? `/${storageConfigured.value.title}` : ''}`)
    },
    itemClick: () => {
      navigateTo(`/account/setup/storage`)
    },
    configured: storageConfigured.value,
  },
  // {
  //   title: t('labels.switchToProd'),
  //   key: 'switchToProd',
  //   description: 'Switch to production-ready app database from existing application database.',
  //   docsLink: 'https://docs.nocodb.com',
  //   buttonClick: () => {
  //     //  TODO: Implement the logic to switch to production
  //   },
  //   isPending: !(appInfo.value as any)?.prodReady,
  // },
])

onMounted(async () => {
  await loadSetupApps()
})
</script>

<template>
  <div class="flex flex-col" data-test-id="nc-setup-main">
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
        <div
          v-for="config of configs"
          :key="config.key"
          class="flex flex-col border-1 rounded-2xl border-gray-200 p-6 gap-2 hover:(shadow bg-gray-10)"
          :class="{
            'cursor-pointer': config.itemClick,
          }"
          :data-testid="`nc-setup-${config.key}`"
          @click="config.itemClick"
        >
          <div class="flex gap-3 items-center" data-rec="true">
            <NcTooltip v-if="!config.configured || config.isPending">
              <template #title>
                <span>
                  {{ $t('activity.pending') }}
                </span>
              </template>
              <GeneralIcon icon="ncAlertCircle" class="text-orange-500 -mt-1 w-6 h-6 nc-pending" />
            </NcTooltip>
            <GeneralIcon v-else icon="circleCheckSolid" class="text-success w-6 h-6 bg-white-500 nc-configured" />

            <span class="font-bold text-base"> {{ config.title }}</span>
          </div>
          <div class="text-gray-600 text-sm">{{ config.description }}</div>

          <div class="flex justify-between mt-4">
            <NcButton
              size="small"
              type="text"
              :href="config.docsLink"
              target="_blank"
              class="!flex items-center !no-underline"
              rel="noopener noreferer"
              @click.stop
            >
              <div class="flex gap-2 items-center">
                Go to docs
                <GeneralIcon icon="ncExternalLink" />
              </div>
            </NcButton>
            <NcButton v-if="config.configured" size="small" type="text" @click.stop="config.buttonClick">
              <div class="flex gap-2 items-center">
                <GeneralIcon icon="ncEdit3" />
                {{ $t('general.edit') }}
              </div>
            </NcButton>
            <NcButton v-else size="small" @click.stop="config.buttonClick">{{ $t('general.configure') }}</NcButton>
          </div>
        </div>
      </div>
    </div>

    <LazyAccountSetupListModal v-if="openedCategory" v-model="listModalDlg" :category="openedCategory" />
  </div>
</template>
