<script setup lang="ts">
const { t } = useI18n()

const configs = ref([
  {
    title: t('labels.setupLabel', { label: t('labels.email') }),
    key: 'email',
    description: 'Configure an email account to send system notifications to your organisation’s users.',
    docsLink: '',
    path: '/account/setup/email'
  },
  {
    title: t('labels.setupLabel', { label: t('labels.storage') }),
    key: 'storage',
    description: 'Configure a storage service to store your organisation’s data.',
    docsLink: '',
    path: '/account/setup/storage'
  },
  {
    title: t('labels.switchToProd'),
    key: 'switchToProd',
    description: 'Configure a production-ready app database to port from the existing built-in application database.',
    docsLink: ''
  },
])
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
          <div class="flex font-bold text-base" data-rec="true">{{ config.title }}</div>
          <div class="text-gray-600 text-tiny">{{config.description}}</div>

          <div class="flex justify-between">
<NcButton size="small !text-tiny" type="text">Go to docs</NcButton>
<NcButton size="small" @click="navigateTo(config.path)">Configure</NcButton>

          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
