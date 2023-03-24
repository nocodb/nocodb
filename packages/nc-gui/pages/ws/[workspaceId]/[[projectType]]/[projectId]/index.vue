<script setup lang="ts">
import tinycolor from 'tinycolor2'
import {
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
  useTheme,
  useUIPermission,
} from '#imports'

definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const { theme, defaultTheme } = useTheme()

const { t } = useI18n()

const { $e } = useNuxtApp()

const route = useRoute()

const router = useRouter()

const { token, signOut, user } = useGlobal()

const projectStore = useProject()

const { saveTheme, loadProject, reset } = projectStore

const { isUIAllowed } = useUIPermission()

const { copy } = useCopy(true)

// create a new sidebar state
const { isOpen, toggle, toggleHasSidebar } = useSidebar('nc-left-sidebar', { hasSidebar: true, isOpen: true })

const dropdownOpen = ref(false)

/** Sidebar ref */
const sidebar = ref()

const email = computed(() => user.value?.email ?? '---')

const logout = async () => {
  await signOut()
  navigateTo('/signin')
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

const copyAuthToken = async () => {
  try {
    if (await copy(token.value!)) {
      // Copied to clipboard
      message.info(t('msg.info.copiedToClipboard'))
    }
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

  // if (route.name.toString().includes('projectType-projectId-index-index') && isUIAllowed('teamAndAuth')) {
  //   addTab({ id: TabType.AUTH, type: TabType.AUTH, title: t('title.teamAndAuth') })
  // }

  /** If v1 url found navigate to corresponding new url */
  const { type, name, view } = route.query
  if (type && name) {
    await router.replace(`/nc/${route.params.projectId}/${type}/${name}${view ? `/${view}` : ''}`)
  }
})

const { loadScope } = useCommandPalette()

onMounted(() => {
  toggle(true)
  toggleHasSidebar(true)
  loadScope('project', { project_id: route.params.projectId })
})

onBeforeUnmount(() => {
  // clearTabs()
  reset()
})

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
          toggleDialog(true, 'teamAndAuth', null, projectId)
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
</script>

<template>
  <div>
    <div>
      <NuxtPage />
      <LazyGeneralPreviewAs float />
    </div>
  </div>
</template>

<style lang="scss" scoped>
:global(#nc-sidebar-left .ant-layout-sider-collapsed) {
  @apply !w-0 !max-w-0 !min-w-0 overflow-x-hidden;
}

.nc-left-sidebar {
  .nc-sidebar-left-toggle-icon {
    @apply opacity-0 transition-opactity duration-200 transition-color text-gray-500/80 hover:text-gray-500/100;

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

.nc-sidebar-header {
  @apply border-[var(--navbar-border)] !bg-[var(--navbar-bg)];
}
</style>
