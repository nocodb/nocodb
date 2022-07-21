<script setup lang="ts">
import { ref } from 'vue'
import { useToast } from 'vue-toastification'
import AppInstall from './AppInstall.vue'
import MdiEditIcon from '~icons/ic/round-edit'
import MdiCloseCircleIcon from '~icons/mdi/close-circle-outline'
import MdiPlusIcon from '~icons/mdi/plus'
const { $api, $e } = useNuxtApp()
const toast = useToast()

const apps = ref<null | Array<any>>(null)
const showPluginUninstallModal = ref(false)
const showPluginInstallModal = ref(false)
const pluginApp = ref<any>(null)

const loadPluginList = async () => {
  try {
    const plugins = (await $api.plugin.list()).list ?? []

    apps.value = plugins.map((p) => ({
      ...p,
      tags: p.tags ? p.tags.split(',') : [],
      parsedInput: p.input && JSON.parse(p.input),
    }))
  } catch (e) {
    console.error(e)
  }
}

const confirmResetPlugin = async () => {
  try {
    await $api.plugin.update(pluginApp.value.id, {
      input: undefined,
      active: false,
    })
    toast.success('Plugin uninstalled successfully')
    showPluginUninstallModal.value = false
    await loadPluginList()
  } catch (e: any) {
    console.log(e)
    toast.error(e.message)
  }

  $e('a:appstore:reset', { app: pluginApp.value.title })
}

const saved = async () => {
  showPluginInstallModal.value = false
  await loadPluginList()
  $e('a:appstore:install', { app: pluginApp.value.title })
}

const installApp = async (app: any) => {
  showPluginInstallModal.value = true
  pluginApp.value = app

  $e('c:appstore:install', { app: app.title })
}

const resetApp = async (app: any) => {
  showPluginUninstallModal.value = true
  pluginApp.value = app
}

onMounted(async () => {
  if (apps.value === null) {
    loadPluginList()
  }
})
</script>

<template>
  <a-modal v-model:visible="showPluginInstallModal" min-width="400px" max-width="700px" min-height="300" :footer="null">
    <AppInstall
      v-if="pluginApp && showPluginInstallModal"
      :id="pluginApp.id"
      @close="showPluginInstallModal = false"
      @saved="saved()"
    />
  </a-modal>

  <a-modal v-model:visible="showPluginUninstallModal" min-width="400px" max-width="700px" min-height="300" :footer="null">
    <div class="flex flex-col">
      <div class="flex">{{ `Please click on submit to reset ${pluginApp && pluginApp.title}` }}</div>
      <div class="flex mt-6 justify-center space-x-2">
        <a-button @click="showPluginUninstallModal = false"> Cancel </a-button>
        <a-button type="primary" @click="confirmResetPlugin"> Submit </a-button>
      </div>
    </div>
  </a-modal>

  <v-dialog min-width="400px" max-width="700px" min-height="300">
    <v-card v-if="pluginApp">
      <v-card-text> Please confirm to reset {{ pluginApp.title }} </v-card-text>
      <v-card-actions>
        <v-btn color="primary" @click="confirmResetPlugin"> Yes </v-btn>
        <v-btn @click="showPluginUninstallModal = false"> No </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <div class="h-full overflow-y-scroll grid grid-cols-2 gap-x-2 gap-y-4">
    <a-card v-for="(app, i) in apps" :key="i" class="relative flex overflow-x-hidden app-item-card !shadow-sm rounded-md w-full">
      <div class="install-btn flex flex-row justify-end space-x-1">
        <a-button v-if="app.parsedInput" size="small" outlined class="!caption capitalize" @click="installApp(app)">
          <div class="flex flex-row justify-center items-center">
            <MdiEditIcon :height="12" />
            Edit
          </div>
        </a-button>
        <a-button v-if="app.parsedInput" size="small" outlined class="caption capitalize" @click="resetApp(app)">
          <div class="flex flex-row justify-center items-center">
            <MdiCloseCircleIcon />
            <div class="flex ml-0.5">Reset</div>
          </div>
        </a-button>
        <a-button v-else size="small" outlined class="caption capitalize" @click="installApp(app)">
          <div class="flex flex-row justify-center items-center">
            <MdiPlusIcon />
            Install
          </div>
        </a-button>
      </div>

      <div class="flex flex-row space-x-2 items-center justify-start w-full">
        <div class="flex w-20 px-4">
          <a-avatar
            shape="circle"
            :style="{
              backgroundColor: app.title === 'SES' ? '#242f3e' : '',
            }"
            :src="`/${app.logo}`"
            :color="app.title === 'SES' ? '#242f3e' : ''"
          >
          </a-avatar>
        </div>
        <div class="flex flex-col flex-grow-1">
          <a-typography-title :level="5">{{ app.title }}</a-typography-title>
          {{ app.description }}
        </div>
      </div>
    </a-card>
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
  font-size: 12px;
  color: #242f3e;
}
</style>
