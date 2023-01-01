<script setup lang="ts">
import tinycolor from 'tinycolor2'
import {
  TabType,
  computed,
  definePageMeta,
  extractSdkResponseErrorMsg,
  isDrawerOrModalExist,
  isMac,
  message,
  navigateTo,
  onBeforeMount,
  onBeforeUnmount,
  onKeyStroke,
  onMounted,
  openLink,
  projectThemeColors,
  ref,
  resolveComponent,
  useCopy,
  useDialog,
  useGlobal,
  useI18n,
  useProject,
  useRoute,
  useRouter,
  useSidebar,
  useTabs,
  useTheme,
  useUIPermission,
} from '#imports'

definePageMeta({
  hideHeader: true,
})

const { theme, defaultTheme } = useTheme()

const { t } = useI18n()

const { $e } = useNuxtApp()

const route = useRoute()

const router = useRouter()

const { appInfo, token, signOut, signedIn, user, currentVersion, isMobileMode, setIsMobileMode } = useGlobal()

const { project, isSharedBase, loadProjectMetaInfo, projectMetaInfo, saveTheme, loadProject, reset } = useProject()

const { clearTabs, addTab } = useTabs()

const { isUIAllowed } = useUIPermission()

const { copy } = useCopy()

// create a new sidebar state
const { isOpen, toggle, toggleHasSidebar } = useSidebar('nc-left-sidebar', { hasSidebar: false, isOpen: false })

const dialogOpen = ref(false)

const openDialogKey = ref<string>('')

const dataSourcesState = ref<string>('')

const dropdownOpen = ref(false)

/** Sidebar ref */
const sidebar = ref<HTMLElement | null>(null)
const toggleSideBarButton = ref<HTMLElement>()

const email = computed(() => user.value?.email ?? '---')

const logout = () => {
  signOut()
  navigateTo('/signin')
}

function toggleDialog(value?: boolean, key?: string, dsState?: string) {
  dialogOpen.value = value ?? !dialogOpen.value
  openDialogKey.value = key || ''
  dataSourcesState.value = dsState || ''
}

provide(ToggleDialogInj, toggleDialog)

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

const copyProjectInfo = async () => {
  try {
    await loadProjectMetaInfo()

    await copy(
      Object.entries(projectMetaInfo.value!)
        .map(([k, v]) => `${k}: **${v}**`)
        .join('\n'),
    )

    // Copied to clipboard
    message.info(t('msg.info.copiedToClipboard'))
  } catch (e: any) {
    console.error(e)
    message.error(e.message)
  }
}

const copyAuthToken = async () => {
  try {
    await copy(token.value!)
    // Copied to clipboard
    message.info(t('msg.info.copiedToClipboard'))
  } catch (e: any) {
    console.error(e)
    message.error(e.message)
  }
}

onKeyStroke(
  'Escape',
  () => {
    dropdownOpen.value = false
  },
  { eventName: 'keydown' },
)

clearTabs()

onBeforeMount(async () => {
  try {
    await loadProject()
  } catch (e: any) {
    if (e.response?.status === 403) {
      // Project is not accessible
      message.error(t('msg.error.projectNotAccessible'))
      router.replace('/')
      return
    }
    message.error(await extractSdkResponseErrorMsg(e))
  }

  if (!route.params.type && isUIAllowed('teamAndAuth')) {
    addTab({ type: TabType.AUTH, title: t('title.teamAndAuth') })
  }

  /** If v1 url found navigate to corresponding new url */
  const { type, name, view } = route.query
  if (type && name) {
    await router.replace(`/nc/${route.params.projectId}/${type}/${name}${view ? `/${view}` : ''}`)
  }
})

const hideSidebarOnClickOrTouchIfMobileMode = (event: MouseEvent | TouchEvent) => {
  // if (!event.target.matches('.show-sidebar-button')) {
  //   this.sidebarVisible = false
  // }

  // event.stopPropagation()
  // event.preventDefault()

  if (!isMobileMode.value || !isOpen.value) {
    return
  }

  // alert('isMobileMode')

  console.log('inside of hideSidebarOnClickOrTouchIfMobileMode')
  console.log('isOpen.value', isOpen.value)
  console.log('event.target')
  console.log(event.target)
  console.log('-------')
  console.log('toggleSideBarButton.value')
  console.log(toggleSideBarButton.value)
  console.log('toggleSideBarButton.value?.contains(event.target as Node)')
  console.log(toggleSideBarButton.value?.contains(event.target as Node))
  console.log('event.target !== toggleSideBarButton.value', event.target !== toggleSideBarButton.value)
  console.log('------------')

  // console.log('sidebar.value')
  // console.log(sidebar.value)
  // debugger

  // console.log('sidebar.value?.contains(event.target as Node)')
  // console.log(sidebar.value?.contains(event.target as Node))

  // debugger
  // if (event.target !== toggleSideBarButton.value && !toggleSideBarButton.value?.contains(event.target as Node)) {
  // alert('now')
  // toggle(false)
  // }

  toggle(!isOpen.value)
  // debugger
  // if (isMobileMode.value && isOpen.value && !event.target?.matchesSelector('.show-sidebar-button')) {
  // if (isMobileMode.value && isOpen.value && event.target !== toggleSideBarButton.value) {
  //   toggle(false)
  // }
}

onMounted(() => {
  toggle(false)
  toggleHasSidebar(true)
  // TODO: use useEventListener instead of onMounted and onBeforeUnmount
  document.addEventListener('click', hideSidebarOnClickOrTouchIfMobileMode)
  document.addEventListener('touchstart', hideSidebarOnClickOrTouchIfMobileMode)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', hideSidebarOnClickOrTouchIfMobileMode)
  document.removeEventListener('touchstart', hideSidebarOnClickOrTouchIfMobileMode)
})

onBeforeUnmount(reset)

function openKeyboardShortcutDialog() {
  $e('a:actions:keyboard-shortcut')

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgKeyboardShortcuts'), {
    'modelValue': isOpen,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false
    close(1000)
  }
}

useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
  if (e.altKey && !e.shiftKey && !cmdOrCtrl) {
    switch (e.keyCode) {
      case 188: {
        // ALT + ,
        if (isUIAllowed('settings') && !isDrawerOrModalExist()) {
          e.preventDefault()
          $e('c:shortcut', { key: 'ALT + ,' })
          toggleDialog(true, 'teamAndAuth')
        }
        break
      }
    }
  }
  if (cmdOrCtrl) {
    switch (e.key) {
      case '/':
        if (!isDrawerOrModalExist()) {
          $e('c:shortcut', { key: 'CTRL + /' })
          openKeyboardShortcutDialog()
        }
        break
    }
  }
})

const FOO_ON_OPEN_CLICK = () => {
  alert('FOO_ON_OPEN_CLICK')
  console.log('inside of FOO_ON_OPEN_CLICK')
  toggle(!isOpen)
}
</script>

<template>
  <NuxtLayout>
    <template #sidebar>
      <div>isOpen: {{ isOpen }}</div>
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
          :class="isOpen ? 'pl-4' : ''"
          class="flex items-center !bg-primary text-white px-1 gap-1"
        >
          <div
            v-if="isOpen && !isSharedBase"
            v-e="['c:navbar:home']"
            data-testid="nc-noco-brand-icon"
            class="w-[29px] min-w-[29px] transition-all duration-200 py-1 pl-1 cursor-pointer transform hover:scale-105 nc-noco-brand-icon"
            @click="navigateTo('/')"
          >
            <a-tooltip placement="bottom">
              <template #title>
                {{ currentVersion }}
              </template>
              <img width="25" class="-mr-1" alt="NocoDB" src="~/assets/img/icons/512x512-trans.png" />
            </a-tooltip>
          </div>

          <a
            v-if="isOpen && isSharedBase"
            class="w-[40px] min-w-[40px] transition-all duration-200 p-1 cursor-pointer transform hover:scale-105"
            href="https://github.com/nocodb/nocodb"
            target="_blank"
          >
            <a-tooltip placement="bottom">
              <template #title>
                {{ currentVersion }}
              </template>
              <img width="25" alt="NocoDB" src="~/assets/img/icons/512x512-trans.png" />
            </a-tooltip>
          </a>

          <div
            ref="toggleSideBarButton"
            class="hover:after:(bg-primary bg-opacity-75) group nc-sidebar-add-row flex items-center px-2"
            style="background-color: 'red'; color: 'green'"
            :class="{ 'nc-sidebar-left-toggle-icon': !isMobileMode }"
            @click.prevent.stop="FOO_ON_OPEN_CLICK"
          >
            <MdiBackburger
              v-e="['c:grid:toggle-navdraw']"
              class="cursor-pointer transform transition-transform duration-500"
              :class="{ 'rotate-180': !isOpen }"
            />
          </div>
        </div>

        <LazyDashboardTreeView @create-base-dlg="toggleDialog(true, 'dataSources')" />
      </a-layout-sider>
    </template>

    <div>
      <LazyDashboardSettingsModal
        v-model:model-value="dialogOpen"
        v-model:open-key="openDialogKey"
        v-model:data-sources-state="dataSourcesState"
      />

      <NuxtPage :page-key="$route.params.projectId" />

      <LazyGeneralPreviewAs float />
    </div>
  </NuxtLayout>
</template>

<style lang="scss" scoped>
:global(#nc-sidebar-left .ant-layout-sider-collapsed) {
  @apply !w-0 !max-w-0 !min-w-0 overflow-x-hidden;
}

.nc-left-sidebar {
  .nc-sidebar-left-toggle-icon {
    @apply opacity-0 transition-opactity duration-200 transition-color text-white/80 hover: text-white/100;

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
