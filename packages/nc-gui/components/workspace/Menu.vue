<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import type { WorkspaceType } from 'nocodb-sdk'
import tinycolor from 'tinycolor2'
import { onMounted, projectThemeColors, ref, useWorkspace } from '#imports'
import { navigateTo } from '#app'

const props = defineProps<{
  isOpen: boolean
}>()

const workspaceStore = useWorkspace()

const { saveTheme } = workspaceStore
const { isWorkspaceOwner } = storeToRefs(workspaceStore)
const { loadWorkspaces } = workspaceStore

const { signOut, signedIn, user, token } = useGlobal()

const { copy } = useCopy(true)

const email = computed(() => user.value?.email ?? '---')

const { isUIAllowed } = useUIPermission()

const { theme, defaultTheme } = useTheme()

onMounted(async () => {
  // await loadWorkspaces()
})

const workspaceModalVisible = ref(false)
const isWorkspaceDropdownOpen = ref(false)
const isAuthTokenCopied = ref(false)

const createDlg = ref(false)

const onWorkspaceCreate = async (workspace: WorkspaceType) => {
  createDlg.value = false
  await loadWorkspaces()
  navigateTo(`/ws/${workspace.id}`)
}

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

const copyAuthToken = async () => {
  try {
    await copy(token.value!)
    isAuthTokenCopied.value = true
  } catch (e: any) {
    console.error(e)
    message.error(e.message)
  }
}

onKeyStroke('Escape', () => {
  if (isWorkspaceDropdownOpen.value) {
    isWorkspaceDropdownOpen.value = false
  }
})
</script>

<template>
  <div class="flex-grow min-w-20">
    <a-dropdown
      v-model:visible="isWorkspaceDropdownOpen"
      class="h-full min-w-0 flex-1"
      :trigger="['click']"
      placement="bottom"
      overlay-class-name="nc-dropdown-workspace-menu"
    >
      <div
        :style="{ width: props.isOpen ? 'calc(100% - 40px) pr-2' : '100%' }"
        :class="[props.isOpen ? '' : 'justify-center']"
        data-testid="nc-workspace-menu"
        class="group cursor-pointer flex gap-1 items-center nc-workspace-menu overflow-hidden py-1.25 pr-0.25"
      >
        <slot name="brandIcon" />
        <template v-if="props.isOpen">
          Nocodb
          <MdiCodeTags class="min-w-[17px] text-md transform rotate-90" />
        </template>

        <template v-else>
          <MdiFolder class="text-primary cursor-pointer transform hover:scale-105 text-2xl" />
        </template>
      </div>

      <template #overlay>
        <a-menu class="" @click="isWorkspaceDropdownOpen = false">
          <a-menu-item-group class="!border-t-0">
            <a-menu-divider />

            <template v-if="!isSharedBase">
              <!-- Copy Auth Token -->
              <a-menu-item key="copy">
                <div
                  v-e="['a:navbar:user:copy-auth-token']"
                  class="nc-workspace-menu-item group !gap-x-3"
                  @click.stop="copyAuthToken"
                >
                  <GeneralIcon v-if="isAuthTokenCopied" icon="check" class="group-hover:text-black" />
                  <GeneralIcon v-else icon="copy" class="group-hover:text-black" />
                  <div v-if="isAuthTokenCopied">
                    {{ $t('activity.account.authTokenCopied') }}
                  </div>
                  <div v-else>
                    {{ $t('activity.account.authToken') }}
                  </div>
                </div>
              </a-menu-item>

              <a-menu-divider v-if="false" />

              <!-- Theme -->
              <template v-if="isUIAllowed('projectTheme') && false">
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
                          <ClarityColorPickerSolid class="group-hover:text-black" />
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
                          <ClarityColorPickerSolid class="group-hover:text-black" />
                          {{ $t('labels.accentColor') }}
                        </div>
                      </template>

                      <template #expandIcon></template>

                      <LazyGeneralChromeWrapper @input="handleThemeColor('accent', $event)" />
                    </a-sub-menu>
                  </a-sub-menu>
                </a-sub-menu>
              </template>

              <a-menu-divider v-if="false" />

              <!-- Preview As -->
              <a-sub-menu v-if="isUIAllowed('previewAs') && false" key="preview-as">
                <template #title>
                  <div v-e="['c:navdraw:preview-as']" class="nc-workspace-menu-item group">
                    <GeneralIcon icon="preview" class="group-hover:text-black" />
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
              v-if="!isEeUI"
              key="language"
              class="lang-menu !py-0"
              popup-class-name="scrollbar-thin-dull min-w-50 max-h-90vh !overflow-auto"
            >
              <template #title>
                <div class="nc-workspace-menu-item group">
                  <GeneralIcon icon="translate" class="group-hover:text-black nc-language" />
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
    <GeneralModal v-model:visible="workspaceModalVisible" :class="{ active: modalVisible }" width="80%" :footer="null">
      <div class="relative flex flex-col px-6 py-2">
        <div class="absolute right-4 top-4 z-20">
          <a-button type="text" class="!p-1 !h-7 !rounded" @click="workspaceModalVisible = false">
            <component :is="iconMap.close" />
          </a-button>
        </div>
        <a-tabs v-model:activeKey="tab">
          <template v-if="isWorkspaceOwner">
            <a-tab-pane key="collab" tab="Collaborators" class="w-full">
              <WorkspaceCollaboratorsList class="h-full" />
            </a-tab-pane>
            <!-- <a-tab-pane key="settings" tab="Settings" class="w-full">
              <div class="min-h-50 flex items-center justify-center">Not available</div>
            </a-tab-pane> -->
          </template>
        </a-tabs>
      </div>
    </GeneralModal>

    <WorkspaceCreateDlg v-model="createDlg" @success="onWorkspaceCreate" />
  </div>
</template>

<style scoped lang="scss">
.nc-workspace-title-input {
  @apply flex-grow py-2 px-3 outline-none hover:(bg-gray-50) focus:(bg-gray-50) font-medium rounded text-md text-defaault;
}

.nc-menu-sub-head {
  @apply pt-2 pb-2 text-gray-500 text-sm px-5;
}

.nc-workspace-menu-item {
  @apply flex items-center pl-2 py-2 gap-2 text-sm hover:text-black;
}

:deep(.ant-dropdown-menu-item-group-title) {
  @apply hidden;
}

:deep(.ant-tabs-nav) {
  @apply !mb-0;
}

:deep(.ant-dropdown-menu-submenu-title) {
  @apply !py-0;
  .nc-icon {
    @apply !text-xs;
  }
}
</style>
