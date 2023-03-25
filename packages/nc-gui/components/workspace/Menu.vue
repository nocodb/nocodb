<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import type { WorkspaceType } from 'nocodb-sdk'
import { useDebounceFn } from '@vueuse/core'
import tinycolor from 'tinycolor2'
import { onMounted, projectThemeColors, ref, useWorkspace } from '#imports'
import { navigateTo } from '#app'

const props = defineProps<{
  isOpen: boolean
}>()

const workspaceStore = useWorkspace()

const { saveTheme } = workspaceStore
const { workspace, workspaces, isWorkspaceOwner } = storeToRefs(workspaceStore)

const { appInfo, token, signOut, signedIn, user, currentVersion } = useGlobal()

const email = computed(() => user.value?.email ?? '---')

const { isUIAllowed } = useUIPermission()

const { theme, defaultTheme } = useTheme()

onMounted(async () => {
  await workspaceStore.loadWorkspaceList()
})

const workspaceModalVisible = ref(false)

const createDlg = ref(false)

const onWorkspaceCreate = async (workspace: WorkspaceType) => {
  createDlg.value = false
  await workspaceStore.loadWorkspaceList()
  navigateTo(`/ws/${workspace.id}`)
}

const updateWorkspaceTitle = useDebounceFn(async () => {
  await workspaceStore.updateWorkspace(workspace.value!.id!, {
    title: workspace.value!.title,
  })
}, 500)

const handleThemeColor = async (mode: 'swatch' | 'primary' | 'accent', color?: string) => {
  switch (mode) {
    case 'swatch': {
      if (color === defaultTheme.primaryColor) {
        return await saveTheme(defaultTheme)
      }

      const tcolor = tinycolor(color)
      if (tcolor.isValid()) {
        const complement = tcolor.complement()

        await saveTheme({
          primaryColor: color,
          accentColor: complement.toHex8String(),
        })
      }
      break
    }
    case 'primary': {
      const tcolor = tinycolor(color)

      if (tcolor.isValid()) {
        await saveTheme({
          primaryColor: color,
        })
      }
      break
    }
    case 'accent': {
      const tcolor = tinycolor(color)

      if (tcolor.isValid()) {
        await saveTheme({
          accentColor: color,
        })
      }
      break
    }
  }
}

const logout = async () => {
  await signOut()
  navigateTo('/signin')
}

// todo: temp
const isSharedBase = false
const modalVisible = false
</script>

<template>
  <div class="flex-grow min-w-20">
    <a-dropdown
      class="h-full min-w-0 flex-1"
      :trigger="['click']"
      placement="bottom"
      overlay-class-name="nc-dropdown-project-menu"
    >
      <div
        :style="{ width: props.isOpen ? 'calc(100% - 40px) pr-2' : '100%' }"
        :class="[props.isOpen ? '' : 'justify-center']"
        data-testid="nc-project-menu"
        class="group cursor-pointer flex gap-1 items-center nc-project-menu overflow-hidden"
      >
        <template v-if="props.isOpen">
          <div class="flex-grow min-w-10">
            <a-tooltip v-if="workspace?.title?.length > 12" placement="bottom">
              <div class="text-md truncate">{{ workspace.title }}</div>
              <template #title>
                <div class="text-sm !text-red-500">{{ workspace?.title }}</div>
              </template>
            </a-tooltip>
            <div v-else class="text-md truncate capitalize">{{ workspace?.title }}</div>
          </div>

          <PhCodeSimpleThin class="min-w-[17px] text-md transform rotate-90" />
        </template>

        <template v-else>
          <MdiFolder class="text-primary cursor-pointer transform hover:scale-105 text-2xl" />
        </template>
      </div>

      <template #overlay>
        <a-menu class="!ml-4 !w-[300px]">
          <a-menu-item-group>
            <!--  <div class="nc-menu-sub-head">Current Workspace</div> -->
            <div class="group select-none flex items-center gap-4 p-2 pb-0">
              <input v-model="workspace.title" class="nc-workspace-title-input text-current" @input="updateWorkspaceTitle" />
            </div>

            <a-menu-item @click="workspaceModalVisible = true">
              <div class="nc-workspace-menu-item group">
                <PhUserCircleThin />
                Collaborators
              </div>
            </a-menu-item>
            <a-menu-item @click="workspaceModalVisible = true">
              <div class="nc-workspace-menu-item group">
                <PhFadersThin />
                Settings
              </div>
            </a-menu-item>

            <a-menu-divider />

            <div class="nc-menu-sub-head">Workspaces</div>

            <div class="max-h-300px overflow-y-auto">
              <a-menu-item v-for="workspace of workspaces" @click="navigateTo(`/ws/${workspace.id}`)">
                <div class="nc-workspace-menu-item group">
                  <GeneralIcon icon="workspace" />

                  {{ workspace.title }}
                </div>
              </a-menu-item>
            </div>
            <a-menu-divider />

            <a-menu-item @click="createDlg = true">
              <div class="nc-workspace-menu-item group">
                <GeneralIcon icon="plus" />

                Add new workspace
              </div>
            </a-menu-item>
            <template v-if="!isSharedBase">
              <!-- Copy Auth Token -->
              <a-menu-item key="copy">
                <div v-e="['a:navbar:user:copy-auth-token']" class="nc-workspace-menu-item group" @click.stop="copyAuthToken">
                  <GeneralIcon icon="copy" class="group-hover:text-accent" />
                  {{ $t('activity.account.authToken') }}
                </div>
              </a-menu-item>

              <a-menu-divider />

              <!-- Theme -->
              <template v-if="isUIAllowed('projectTheme')">
                <a-sub-menu key="theme">
                  <template #title>
                    <div class="nc-workspace-menu-item group">
                      <GeneralIcon icon="image" class="group-hover:text-accent" />
                      {{ $t('activity.account.themes') }}

                      <div class="flex-1" />

                      <MaterialSymbolsChevronRightRounded
                        class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400"
                      />
                    </div>
                  </template>

                  <template #expandIcon></template>

                  <LazyGeneralColorPicker
                    :model-value="theme.primaryColor"
                    :colors="projectThemeColors"
                    :row-size="9"
                    :advanced="false"
                    class="rounded-t"
                    @input="handleThemeColor('swatch', $event)"
                  />

                  <!-- Custom Theme -->
                  <a-sub-menu key="theme-2">
                    <template #title>
                      <div class="nc-workspace-menu-item group">
                        {{ $t('labels.customTheme') }}

                        <div class="flex-1" />

                        <MaterialSymbolsChevronRightRounded
                          class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400"
                        />
                      </div>
                    </template>

                    <!-- Primary Color -->
                    <template #expandIcon></template>

                    <a-sub-menu key="pick-primary">
                      <template #title>
                        <div class="nc-workspace-menu-item group">
                          <ClarityColorPickerSolid class="group-hover:text-accent" />
                          {{ $t('labels.primaryColor') }}
                        </div>
                      </template>

                      <template #expandIcon></template>

                      <LazyGeneralChromeWrapper @input="handleThemeColor('primary', $event)" />
                    </a-sub-menu>

                    <!-- Accent Color -->
                    <a-sub-menu key="pick-accent">
                      <template #title>
                        <div class="nc-workspace-menu-item group">
                          <ClarityColorPickerSolid class="group-hover:text-accent" />
                          {{ $t('labels.accentColor') }}
                        </div>
                      </template>

                      <template #expandIcon></template>

                      <LazyGeneralChromeWrapper @input="handleThemeColor('accent', $event)" />
                    </a-sub-menu>
                  </a-sub-menu>
                </a-sub-menu>
              </template>

              <a-menu-divider />

              <!-- Preview As -->
              <a-sub-menu v-if="isUIAllowed('previewAs')" key="preview-as">
                <template #title>
                  <div v-e="['c:navdraw:preview-as']" class="nc-workspace-menu-item group">
                    <GeneralIcon icon="preview" class="group-hover:text-accent" />
                    {{ $t('activity.previewAs') }}

                    <div class="flex-1" />

                    <MaterialSymbolsChevronRightRounded
                      class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400"
                    />
                  </div>
                </template>

                <template #expandIcon></template>

                <LazyGeneralPreviewAs />
              </a-sub-menu>
            </template>
            <!-- Language -->
            <a-sub-menu
              key="language"
              class="lang-menu !py-0"
              popup-class-name="scrollbar-thin-dull min-w-50 max-h-90vh !overflow-auto"
            >
              <template #title>
                <div class="nc-workspace-menu-item group">
                  <GeneralIcon icon="translate" class="group-hover:text-accent nc-language" />
                  {{ $t('labels.language') }}
                  <div class="flex items-center text-gray-400 text-xs">(Community Translated)</div>
                  <div class="flex-1" />

                  <MaterialSymbolsChevronRightRounded
                    class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400"
                  />
                </div>
              </template>

              <template #expandIcon></template>

              <LazyGeneralLanguageMenu />
            </a-sub-menu>

            <!-- Account -->
            <template v-if="signedIn && !isSharedBase">
              <a-sub-menu key="account">
                <template #title>
                  <div class="nc-workspace-menu-item group">
                    <GeneralIcon icon="account" class="group-hover:text-accent" />
                    {{ $t('labels.account') }}
                    <div class="flex-1" />

                    <MaterialSymbolsChevronRightRounded
                      class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400"
                    />
                  </div>
                </template>

                <template #expandIcon></template>

                <a-menu-item key="0" class="!rounded-t">
                  <nuxt-link v-e="['c:navbar:user:email']" class="nc-workspace-menu-item group !no-underline" to="/account/users">
                    <GeneralIcon icon="at" class="mt-1 group-hover:text-accent" />&nbsp;
                    <div class="prose-sm group-hover:text-primary">
                      <div>Account</div>
                      <div class="text-xs text-gray-500">{{ email }}</div>
                    </div>
                  </nuxt-link>
                </a-menu-item>

                <a-menu-item key="1" class="!rounded-b">
                  <div v-e="['a:navbar:user:sign-out']" class="nc-workspace-menu-item group" @click="logout">
                    <GeneralIcon icon="signout" class="group-hover:(!text-accent)" />&nbsp;

                    <span class="prose-sm nc-user-menu-signout">
                      {{ $t('general.signOut') }}
                    </span>
                  </div>
                </a-menu-item>
              </a-sub-menu>
            </template>
          </a-menu-item-group>
        </a-menu>
      </template>
    </a-dropdown>
    <a-modal v-model:visible="workspaceModalVisible" :class="{ active: modalVisible }" width="80%" :footer="null">
      <a-tabs v-model:activeKey="tab">
        <template v-if="isWorkspaceOwner">
          <a-tab-pane key="collab" tab="Collaborators" class="w-full">
            <WorkspaceCollaboratorsList class="h-full overflow-auto" />
          </a-tab-pane>
          <a-tab-pane key="settings" tab="Settings" class="w-full">
            <div class="min-h-50 flex items-center justify-center">Not available</div>
          </a-tab-pane>
        </template>
      </a-tabs>
    </a-modal>

    <WorkspaceCreateDlg v-model="createDlg" @success="onWorkspaceCreate" />
  </div>
</template>

<style scoped lang="scss">
.nc-workspace-title-input {
  @apply flex-grow py-2 px-3 outline-none hover:(bg-gray-100) focus:(bg-gray-100) rounded text-md text-defaault;
}

.nc-menu-sub-head {
  @apply pt-2 pb-2 text-gray-500 text-sm px-5;
}

.nc-workspace-menu-item {
  @apply flex items-center pl-2 py-2 gap-2 text-sm;
}

:deep(.ant-dropdown-menu-submenu-title) {
  @apply !py-0;
  .nc-icon {
    @apply !text-xs;
  }
}
</style>
