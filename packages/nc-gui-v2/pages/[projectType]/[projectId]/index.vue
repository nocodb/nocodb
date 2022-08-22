<script setup lang="ts">
import { Chrome } from '@ckpack/vue-color'
import { message } from 'ant-design-vue'
import {
  computed,
  definePageMeta,
  navigateTo,
  onKeyStroke,
  openLink,
  provide,
  provideSidebar,
  ref,
  useClipboard,
  useGlobal,
  useProject,
  useRoute,
  useTabs,
  useTheme,
  useUIPermission,
  watch,
} from '#imports'
import { TabType } from '~/composables'

definePageMeta({
  hideHeader: true,
})

const route = useRoute()

const { appInfo, token, signOut, signedIn, user } = useGlobal()

const { project, loadProject, loadTables, isSharedBase, loadProjectMetaInfo, projectMetaInfo } = useProject()

const { addTab, clearTabs } = useTabs()

const { isUIAllowed } = useUIPermission()

const { copy } = useClipboard()

const isLocked = ref(false)

provide('TreeViewIsLockedInj', isLocked)

// create a new sidebar state
const { isOpen, toggle } = provideSidebar({ isOpen: true })

const dialogOpen = ref(false)

const openDialogKey = ref<string>()

const dropdownOpen = ref(false)

/** Sidebar ref */
const sidebar = ref()

const pickedColor = ref<any>('#ffffff')

let pickerActive = $ref<boolean | 'primary' | 'accent'>(false)

const email = computed(() => user.value?.email ?? '---')

const { setTheme, theme } = useTheme()

watch(pickedColor, (nextColor) => {
  if (pickerActive && nextColor.hex) {
    setTheme({
      primaryColor: pickerActive === 'primary' ? nextColor.hex : theme.value.primaryColor,
      accentColor: pickerActive === 'accent' ? nextColor.hex : theme.value.accentColor,
    })
  }
})

const logout = () => {
  signOut()
  navigateTo('/signin')
}

onKeyStroke(
  'Escape',
  () => {
    dropdownOpen.value = false
  },
  { eventName: 'keydown' },
)

clearTabs()

function toggleDialog(value?: boolean, key?: string) {
  dialogOpen.value = value ?? !dialogOpen.value
  openDialogKey.value = key
}

await loadProject()

await loadTables()

if (!route.params.type && isUIAllowed('teamAndAuth')) {
  addTab({ type: TabType.AUTH, title: 'Team & Auth' })
}

const copyProjectInfo = async () => {
  try {
    await loadProjectMetaInfo()

    await copy(
      Object.entries(projectMetaInfo.value!)
        .map(([k, v]) => `${k}: **${v}**`)
        .join('\n'),
    )

    message.info('Copied project info to clipboard')
  } catch (e: any) {
    console.log(e)
    message.error(e.message)
  }
}

const copyAuthToken = async () => {
  try {
    await copy(token.value!)

    message.info('Copied auth token to clipboard')
  } catch (e: any) {
    console.log(e)
    message.error(e.message)
  }
}

const openColorPicker = (type: 'primary' | 'accent') => {
  if (!pickerActive || pickerActive !== type) {
    pickedColor.value = type === 'primary' ? theme.value.primaryColor : theme.value.accentColor
    pickerActive = type
  } else {
    pickerActive = false
  }
}

const onMenuClose = (visible: boolean) => {
  if (!visible) {
    pickedColor.value = '#ffffff'
    pickerActive = false
  }
}
</script>

<template>
  <NuxtLayout id="content" class="flex">
    <template #sidebar>
      <a-layout-sider
        ref="sidebar"
        :collapsed="!isOpen"
        width="250"
        collapsed-width="50"
        class="relative shadow-md h-full z-1 nc-left-sidebar"
        :trigger="null"
        collapsible
        theme="light"
      >
        <div
          style="height: var(--header-height)"
          :class="isOpen ? 'pl-6' : ''"
          class="flex items-center !bg-primary text-white px-1 gap-2"
        >
          <div
            v-if="isOpen && !isSharedBase"
            class="w-[40px] min-w-[40px] transition-all duration-200 p-1 cursor-pointer transform hover:scale-105"
            @click="navigateTo('/')"
          >
            <img alt="NocoDB" src="~/assets/img/icons/512x512-trans.png" />
          </div>

          <a
            v-if="isOpen && isSharedBase"
            class="w-[40px] min-w-[40px] transition-all duration-200 p-1 cursor-pointer transform hover:scale-105"
            href="https://github.com/nocodb/nocodb"
            target="_blank"
          >
            <img alt="NocoDB" src="~/assets/img/icons/512x512-trans.png" />
          </a>

          <div v-if="isSharedBase">
            <template v-if="isOpen">
              <div class="text-xl font-semibold truncate">{{ project.title }}</div>
            </template>

            <template v-else>
              <MdiFolder class="text-primary cursor-pointer transform hover:scale-105 text-2xl" />
            </template>
          </div>

          <a-dropdown v-else class="h-full min-w-0 flex-1" :trigger="['click']" placement="bottom" @visible-change="onMenuClose">
            <div
              :style="{ width: isOpen ? 'calc(100% - 40px) pr-2' : '100%' }"
              :class="[isOpen ? '' : 'justify-center']"
              class="group cursor-pointer flex gap-1 items-center nc-project-menu overflow-hidden"
            >
              <template v-if="isOpen">
                <a-tooltip v-if="project.title?.length > 12" placement="bottom">
                  <div class="text-lg font-semibold truncate">{{ project.title }}</div>
                  <template #title>
                    <div class="text-sm">{{ project.title }}</div>
                  </template>
                </a-tooltip>
                <div v-else class="text-lg font-semibold truncate">{{ project.title }}</div>

                <MdiChevronDown class="min-w-[17px] group-hover:text-accent text-md" />
              </template>

              <template v-else>
                <MdiFolder class="text-primary cursor-pointer transform hover:scale-105 text-2xl" />
              </template>
            </div>

            <template #overlay>
              <a-menu class="ml-6 !w-[300px] !text-sm !p-0 !rounded">
                <a-menu-item-group>
                  <template #title>
                    <div class="group select-none flex items-center gap-4 py-1">
                      <MdiFolder class="group-hover:text-accent text-xl" />

                      <div class="flex flex-col">
                        <div class="text-lg group-hover:(!text-primary) font-semibold truncate">{{ project.title }}</div>

                        <div class="flex items-center gap-1">
                          <div class="group-hover:(!text-primary)">ID:</div>

                          <div class="text-xs group-hover:text-accent truncate font-italic">{{ project.id }}</div>
                        </div>
                      </div>
                    </div>
                  </template>

                  <a-menu-item key="copy">
                    <div class="nc-project-menu-item group" @click.stop="copyProjectInfo">
                      <MdiContentCopy class="group-hover:text-accent" />
                      Copy Project Info
                    </div>
                  </a-menu-item>

                  <a-menu-divider />

                  <a-menu-item key="api">
                    <div
                      v-if="isUIAllowed('apiDocs')"
                      v-t="['e:api-docs']"
                      class="nc-project-menu-item group"
                      @click.stop="openLink(`/api/v1/db/meta/projects/${route.params.projectId}/swagger`, appInfo.ncSiteUrl)"
                    >
                      <MdiApi class="group-hover:text-accent" />
                      Swagger: Rest APIs
                    </div>
                  </a-menu-item>

                  <a-menu-item key="copy">
                    <div v-t="['a:navbar:user:copy-auth-token']" class="nc-project-menu-item group" @click.stop="copyAuthToken">
                      <MdiScriptTextKeyOutline class="group-hover:text-accent" />
                      Copy Auth Token
                    </div>
                  </a-menu-item>

                  <a-menu-divider />

                  <a-menu-item key="teamAndSettings">
                    <div
                      v-if="isUIAllowed('settings')"
                      v-t="['c:navdraw:project-settings']"
                      class="nc-project-menu-item group"
                      @click="toggleDialog(true, 'teamAndAuth')"
                    >
                      <MdiCog class="group-hover:text-accent" />
                      Team & Settings
                    </div>
                  </a-menu-item>

                  <a-menu-divider />

                  <a-sub-menu v-if="isUIAllowed('previewAs')" key="preview-as">
                    <template #title>
                      <div v-t="['c:navdraw:preview-as']" class="nc-project-menu-item group">
                        <MdiFileEyeOutline class="group-hover:text-accent" />
                        Preview Project As

                        <div class="flex-1" />

                        <MaterialSymbolsChevronRightRounded
                          class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400"
                        />
                      </div>
                    </template>

                    <template #expandIcon></template>

                    <GeneralPreviewAs />
                  </a-sub-menu>

                  <a-sub-menu key="language" class="lang-menu scrollbar-thin-dull min-w-50 max-h-90vh overflow-auto !py-0">
                    <template #title>
                      <div class="nc-project-menu-item group">
                        <MaterialSymbolsTranslate class="group-hover:text-accent nc-language" />
                        Language
                        <div class="flex-1" />

                        <MaterialSymbolsChevronRightRounded
                          class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400"
                        />
                      </div>
                    </template>

                    <template #expandIcon></template>
                    <GeneralLanguageMenu />
                  </a-sub-menu>

                  <template v-if="signedIn && !isSharedBase">
                    <a-sub-menu key="account">
                      <template #title>
                        <div class="nc-project-menu-item group">
                          <MdiAccount class="group-hover:text-accent" />
                          Account
                          <div class="flex-1" />

                          <MaterialSymbolsChevronRightRounded
                            class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400"
                          />
                        </div>
                      </template>

                      <template #expandIcon></template>

                      <a-menu-item key="0" class="!rounded-t">
                        <nuxt-link v-t="['c:navbar:user:email']" class="nc-project-menu-item group !no-underline" to="/user">
                          <MdiAt class="mt-1 group-hover:text-accent" />&nbsp;

                          <span class="prose-sm">{{ email }}</span>
                        </nuxt-link>
                      </a-menu-item>

                      <a-menu-item key="1" class="!rounded-b">
                        <div v-t="['a:navbar:user:sign-out']" class="nc-project-menu-item group" @click="logout">
                          <MdiLogout class="group-hover:(!text-accent)" />&nbsp;

                          <span class="prose-sm">
                            {{ $t('general.signOut') }}
                          </span>
                        </div>
                      </a-menu-item>
                    </a-sub-menu>
                  </template>

                  <a-menu-divider />

                  <a-sub-menu>
                    <template #title>
                      <div class="nc-project-menu-item group">
                        <ClarityImageLine class="group-hover:text-accent" />
                        Theme

                        <div class="flex-1" />

                        <MaterialSymbolsChevronRightRounded
                          class="transform group-hover:(scale-115 text-accent) text-xl text-gray-400"
                        />
                      </div>
                    </template>

                    <template #expandIcon></template>

                    <a-menu-item>
                      <div class="nc-project-menu-item group" @click.stop="openColorPicker('primary')">
                        <ClarityColorPickerSolid class="group-hover:text-accent" />
                        Primary Color
                      </div>
                    </a-menu-item>

                    <a-menu-item>
                      <div class="nc-project-menu-item group" @click.stop="openColorPicker('accent')">
                        <ClarityColorPickerSolid class="group-hover:text-accent" />
                        Accent Color
                      </div>
                    </a-menu-item>
                  </a-sub-menu>

                  <Chrome
                    v-if="pickerActive"
                    v-model="pickedColor"
                    class="z-99 absolute right-[-225px]"
                    @click.stop
                    @blur="onMenuClose(false)"
                  />
                </a-menu-item-group>
              </a-menu>
            </template>
          </a-dropdown>

          <div
            class="nc-sidebar-left-toggle-icon hover:after:(bg-primary bg-opacity-75) group nc-sidebar-add-row flex items-center px-2"
          >
            <MdiBackburger
              class="cursor-pointer transform transition-transform duration-500"
              :class="{ 'rotate-180': !isOpen }"
              @click="toggle(!isOpen)"
            />
          </div>
        </div>

        <DashboardTreeView v-show="isOpen" />
      </a-layout-sider>
    </template>
    <div :key="$route.fullPath">
      <dashboard-settings-modal v-model="dialogOpen" :open-key="openDialogKey" />
      <NuxtPage />
      <GeneralPreviewAs float />
    </div>
  </NuxtLayout>
</template>

<style lang="scss" scoped>
:global(#nc-sidebar-left .ant-layout-sider-collapsed) {
  @apply !w-0 !max-w-0 !min-w-0 overflow-x-hidden;
}

.nc-left-sidebar {
  .nc-sidebar-left-toggle-icon {
    @apply opacity-0 transition-opactity duration-200 transition-color text-white/80 hover:text-white/100;

    .nc-left-sidebar {
      @apply !border-r-0;
    }
  }

  &:hover .nc-sidebar-left-toggle-icon {
    @apply opacity-100;
  }
}

:deep(.ant-dropdown-menu-submenu-title) {
  @apply py-0;
}
</style>
