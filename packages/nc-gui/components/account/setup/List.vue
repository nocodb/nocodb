<script setup lang="ts">
const props = defineProps<{
  category: string
}>()

const { categorizeApps, resetPlugin: _resetPlugin, showPluginUninstallModal, activePlugin } = useAccountSetupStoreOrThrow()

const apps = computed(() => categorizeApps.value?.[props.category?.toLowerCase()] || [])
const showResetActiveAppMsg = ref(false)
const switchingTo = ref(null)

const selectApp = (app: any) => {
  const activeApp = !app.active && apps.value.find((a: any) => a.active)
  if (activeApp) {
    switchingTo.value = app
    return showResetPluginModal(activeApp, true)
  }

  navigateTo(`/account/setup/${props.category}/${app.title}`)
}

const showResetPluginModal = async (app: any, resetActiveAppMsg = false) => {
  showResetActiveAppMsg.value = resetActiveAppMsg
  showPluginUninstallModal.value = true
  activePlugin.value = app
}

const resetPlugin = async () => {
  await _resetPlugin(activePlugin.value)
  if (showResetActiveAppMsg.value) {
    await selectApp(switchingTo.value)
    switchingTo.value = null
    showResetActiveAppMsg.value = false
  }
}

const closeResetModal = () => {
  activePlugin.value = null
  switchingTo.value = null
  showResetActiveAppMsg.value = false
  showPluginUninstallModal.value = false
}
</script>

<template>
  <div class="flex flex-col" data-test-id="nc-setup">
    <NcPageHeader>
      <template #title>
        <span data-rec="true">
          {{ category }}
        </span>
      </template>
    </NcPageHeader>
    <div class="h-[calc(100%_-_58px)] flex">
      <div class="w-full">
        <div class="w-950px px-4 mt-3 mx-auto text-lg font-weight-bold">{{ category }}</div>
        <div class="container">
          <div v-for="app in apps" :key="app.title" class="item group" @click="selectApp(app)">
            <img
              v-if="app.title !== 'SMTP'"
              class="icon"
              :alt="app.title"
              :style="{
                backgroundColor: app.title === 'SES' ? '#242f3e' : '',
              }"
              :src="app.logo"
            />
            <GeneralIcon v-else icon="mail" />
            <span class="title">{{ app.title }}</span>
            <div class="flex-grow" />

            <GeneralIcon
              v-if="app.active"
              icon="delete"
              class="text-error min-w-6 h-6 bg-white-500 !hidden !group-hover:!inline cursor-pointer"
              @click.stop="showResetPluginModal(app)"
            />
            <GeneralIcon v-if="app.active" icon="circleCheckSolid" class="text-primary min-w-6 h-6 bg-white-500" />
          </div>
        </div>
      </div>
    </div>

    <a-modal
      v-model:visible="showPluginUninstallModal"
      :closable="false"
      width="24rem"
      centered
      :footer="null"
      wrap-class-name="nc-modal-plugin-uninstall"
    >
      <div class="flex flex-col h-full">
        <div class="flex flex-row justify-center mt-2 text-center w-full text-base">
          <template v-if="showResetActiveAppMsg">
            Switching to {{ switchingTo && switchingTo.title }} will reset your {{ activePlugin && activePlugin.title }}
            settings. Continue?
          </template>
          <template v-else>{{ `Click on confirm to reset ${activePlugin && activePlugin.title}` }}</template>
        </div>
        <div class="flex mt-6 justify-center space-x-2">
          <NcButton type="secondary" @click="closeResetModal"> {{ $t('general.cancel') }}</NcButton>
          <NcButton type="danger" @click="resetPlugin"> {{ $t('general.confirm') }}</NcButton>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<style scoped lang="scss">
.container {
  @apply p-4 w-950px gap-5 mx-auto my-2 grid grid-cols-3;

  .item {
    @apply text-base w-296px max-w-296px flex gap-6 border-1 border-gray-200 py-3 px-6 rounded-xl items-center cursor-pointer hover:(shadow bg-gray-50);

    .icon {
      @apply max-w-32px max-h-32px;
    }

    .title {
      @apply font-weight-bold;
    }
  }
}
</style>
