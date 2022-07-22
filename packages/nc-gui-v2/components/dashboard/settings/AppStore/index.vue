<script setup lang="ts">
import { useToast } from 'vue-toastification'
import AppInstall from './AppInstall.vue'
import MdiEditIcon from '~icons/ic/round-edit'
import MdiCloseCircleIcon from '~icons/mdi/close-circle-outline'
import MdiPlusIcon from '~icons/mdi/plus'
const { $api, $e } = useNuxtApp()
const toast = useToast()

let apps = $ref<null | Array<any>>(null)
let showPluginUninstallModal = $ref(false)
let showPluginInstallModal = $ref(false)
let pluginApp = $ref<any>(null)

const fetchPluginApps = async () => {
  try {
    const plugins = (await $api.plugin.list()).list ?? []

    apps = plugins.map((p) => ({
      ...p,
      tags: p.tags ? p.tags.split(',') : [],
      parsedInput: p.input && JSON.parse(p.input),
    }))
  } catch (e) {
    console.error(e)
    toast.error('Something went wrong')
  }
}

const resetPlugin = async () => {
  try {
    await $api.plugin.update(pluginApp.id, {
      input: undefined,
      active: false,
    })
    toast.success('Plugin uninstalled successfully')
    showPluginUninstallModal = false
    await fetchPluginApps()
  } catch (e: any) {
    console.log(e)
    toast.error(e.message)
  }

  $e('a:appstore:reset', { app: pluginApp.title })
}

const saved = async () => {
  showPluginInstallModal = false
  await fetchPluginApps()
  $e('a:appstore:install', { app: pluginApp.title })
}

const showInstallPluginModal = async (app: any) => {
  showPluginInstallModal = true
  pluginApp = app

  $e('c:appstore:install', { app: app.title })
}

const showResetPluginModal = async (app: any) => {
  showPluginUninstallModal = true
  pluginApp = app
}

onMounted(async () => {
  if (apps === null) {
    fetchPluginApps()
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

  <a-modal v-model:visible="showPluginUninstallModal" :closable="false" width="22rem" centered :footer="null">
    <div class="flex flex-col h-full">
      <div class="flex flex-row justify-center mt-2 text-center w-full">
        {{ `Are you sure you to reset ${pluginApp && pluginApp.title}` }}
      </div>
      <div class="flex mt-10 justify-center space-x-2">
        <a-button @click="showPluginUninstallModal = false"> Cancel </a-button>
        <a-button type="primary" danger @click="resetPlugin"> Reset </a-button>
      </div>
    </div>
  </a-modal>

  <v-dialog min-width="400px" max-width="700px" min-height="300">
    <v-card v-if="pluginApp">
      <v-card-text> Please confirm to reset {{ pluginApp.title }} </v-card-text>
      <v-card-actions>
        <v-btn color="primary" @click="resetPlugin"> Yes </v-btn>
        <v-btn @click="showPluginUninstallModal = false"> No </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <div class="h-full overflow-y-scroll grid grid-cols-2 gap-x-2 gap-y-4">
    <a-card
      v-for="(app, i) in apps"
      :key="i"
      class="relative flex overflow-x-hidden app-item-card !shadow-sm rounded-md w-full"
      :body-style="{ width: '100%' }"
    >
      <div class="install-btn flex flex-row justify-end space-x-1">
        <a-button v-if="app.parsedInput" size="small" outlined @click="showInstallPluginModal(app)">
          <div class="flex flex-row justify-center items-center caption capitalize">
            <MdiEditIcon class="pr-0.5" :height="12" />
            Edit
          </div>
        </a-button>
        <a-button v-if="app.parsedInput" size="small" outlined @click="showResetPluginModal(app)">
          <div class="flex flex-row justify-center items-center caption capitalize">
            <MdiCloseCircleIcon />
            <div class="flex ml-0.5">Reset</div>
          </div>
        </a-button>
        <a-button v-else size="small" outlined @click="showInstallPluginModal(app)">
          <div class="flex flex-row justify-center items-center caption capitalize">
            <MdiPlusIcon />
            Install
          </div>
        </a-button>
      </div>

      <div class="flex flex-row space-x-2 items-center justify-start w-full">
        <div class="flex w-20 pl-3">
          <img
            v-if="app.title !== 'SMTP'"
            class="avatar"
            :style="{
              backgroundColor: app.title === 'SES' ? '#242f3e' : '',
            }"
            :src="`/${app.logo}`"
          />
          <div v-else />
        </div>
        <div class="flex flex-col flex-grow-1 w-3/5 pl-3">
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
  font-size: 0.7rem;
  color: #242f3e;
}

.avatar {
  width: 5rem;
  height: 5rem;
  padding: 0.25rem;
  object-fit: contain;
}
</style>
