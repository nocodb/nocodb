<script setup lang="ts">
import { extractSdkResponseErrorMsg, iconMap, message, onMounted, useI18n, useNuxtApp } from '#imports'

const { t } = useI18n()

const { $api, $e } = useNuxtApp()

const apps = ref<null | any[]>(null)

const showPluginUninstallModal = ref(false)

const showPluginInstallModal = ref(false)

const pluginApp = ref<any>(null)

const fetchPluginApps = async () => {
  try {
    const plugins = (await $api.plugin.list()).list ?? []

    apps.value = plugins.map((p) => ({
      ...p,
      tags: p.tags ? p.tags.split(',') : [],
      parsedInput: p.input && JSON.parse(p.input as string),
    }))
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const resetPlugin = async () => {
  try {
    await $api.plugin.update(pluginApp.value.id, {
      input: null,
      active: false,
    })
    // Plugin uninstalled successfully
    message.success(t('msg.success.pluginUninstalled'))
    showPluginUninstallModal.value = false
    await fetchPluginApps()
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }

  $e('a:appstore:reset', { app: pluginApp.value.title })
}

const saved = async () => {
  showPluginInstallModal.value = false
  await fetchPluginApps()
  $e('a:appstore:install', { app: pluginApp.value.title })
}

const showInstallPluginModal = async (app: any) => {
  showPluginInstallModal.value = true
  pluginApp.value = app

  $e('c:appstore:install', { app: app.title })
}

const showResetPluginModal = async (app: any) => {
  showPluginUninstallModal.value = true
  pluginApp.value = app
}

onMounted(async () => {
  if (apps.value === null) {
    await fetchPluginApps()
  }
})
</script>

<template>
  <div>
    <a-modal
      v-model:visible="showPluginInstallModal"
      :class="{ active: showPluginInstallModal }"
      :closable="false"
      centered
      min-height="300"
      :footer="null"
      wrap-class-name="nc-modal-plugin-install"
      v-bind="$attrs"
    >
      <LazyDashboardSettingsAppStoreAppInstall
        v-if="pluginApp && showPluginInstallModal"
        :id="pluginApp.id"
        @close="showPluginInstallModal = false"
        @saved="saved()"
      />
    </a-modal>

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
          {{ `Click on confirm to reset ${pluginApp && pluginApp.title}` }}
        </div>
        <div class="flex mt-6 justify-center space-x-2">
          <NcButton type="secondary" @click="showPluginUninstallModal = false"> {{ $t('general.cancel') }} </NcButton>
          <NcButton type="danger" @click="resetPlugin"> {{ $t('general.confirm') }} </NcButton>
        </div>
      </div>
    </a-modal>

    <div class="flex flex-wrap mt-4 w-full gap-5 mb-10">
      <a-card
        v-for="(app, i) in apps"
        :key="i"
        class="sm:w-100 md:w-138.1"
        :class="`relative flex overflow-x-hidden app-item-card !shadow-sm rounded-md w-full nc-app-store-card-${app.title}`"
      >
        <div class="install-btn flex flex-row justify-end space-x-1">
          <a-button v-if="app.parsedInput" size="small" type="primary" @click="showInstallPluginModal(app)">
            <div class="flex flex-row justify-center items-center caption capitalize nc-app-store-card-edit">
              <IcRoundEdit class="pr-0.5" :height="12" />
              {{ $t('general.edit') }}
            </div>
          </a-button>

          <a-button v-if="app.parsedInput" size="small" outlined @click="showResetPluginModal(app)">
            <div class="flex flex-row justify-center items-center caption capitalize nc-app-store-card-reset">
              <component :is="iconMap.closeCircle" />
              <div class="flex ml-0.5">{{ $t('general.reset') }}</div>
            </div>
          </a-button>

          <a-button v-else size="small" type="primary" @click="showInstallPluginModal(app)">
            <div class="flex flex-row justify-center items-center caption capitalize nc-app-store-card-install">
              <component :is="iconMap.plus" />
              {{ $t('general.install') }}
            </div>
          </a-button>
        </div>

        <div class="flex flex-row space-x-2 items-center justify-start w-full">
          <div class="flex w-20 pl-3">
            <img
              v-if="app.title !== 'SMTP'"
              class="avatar"
              alt="logo"
              :style="{
                backgroundColor: app.title === 'SES' ? '#242f3e' : '',
              }"
              :src="app.logo"
            />

            <div v-else />
          </div>

          <div class="flex flex-col flex-1 w-3/5 pl-3">
            <a-typography-title :level="5">{{ app.title }}</a-typography-title>

            {{ app.description }}
          </div>
        </div>
      </a-card>
    </div>
  </div>
</template>

<style scoped lang="scss">
.app-item-card {
  position: relative;
  transition: 0.4s background-color;

  .install-btn {
    position: absolute;
    opacity: 1;
    right: -100%;
    top: 10px;
    transition: 0.4s opacity, 0.4s right;
  }

  &:hover .install-btn {
    right: 10px;
    opacity: 1;
  }
}

.app-item-card {
  transition: 0.4s background-color, 0.4s transform;

  &:hover {
    background: rgba(123, 126, 136, 0.1) !important;
  }
}

.caption {
  font-size: 0.7rem;
}

.avatar {
  width: 5rem;
  height: 5rem;
  padding: 0.25rem;
  object-fit: contain;
}
</style>
