<script setup lang="ts">
const { t } = useI18n()

const { loadSetupApps, emailConfigured, storageConfigured, listModalDlg } = useProvideAccountSetupStore()

const openedCategory = ref<string | null>(null)

const configs = computed(() => [
  {
    title: t('labels.setupLabel', { label: t('labels.email') }),
    key: 'email',
    description: 'Configure an email account to send system notifications to your organisation’s users.',
    docsLink: '',
    onClick: () => {
      listModalDlg.value = true
      openedCategory.value = 'Email'
    },
    configured: emailConfigured.value,
  },
  {
    title: t('labels.setupLabel', { label: t('labels.storage') }),
    key: 'storage',
    description: 'Configure a storage service to store your organisation’s data.',
    docsLink: '',
    onClick: () => {
      listModalDlg.value = true
      openedCategory.value = 'Storage'
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
    isPending: !isEeUI,
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

            <div
              v-if="!config.configured || config.isPending"
              class="flex items-center gap-1 text-orange-500 bg-orange-50 border-1 border-orange-500 px-1 rounded"
            >
              <GeneralIcon icon="warning" class="text-orange-500" />
              {{ $t('activity.pending') }}
            </div>
          </div>
          <div class="text-gray-600 text-sm">{{ config.description }}</div>

          <div class="flex justify-between mt-4"  v-if="config.configured">
            <div class="flex gap-2">
<GeneralIcon icon="check" class="text-green-500" />

            </div>
          </div>
          <div v-else class="flex justify-between mt-4" >
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

    <LazyAccountSetupListModal v-if="openedCategory" :category="openedCategory" v-model="listModalDlg" />
  </div>
</template>

<style scoped lang="scss"></style>
