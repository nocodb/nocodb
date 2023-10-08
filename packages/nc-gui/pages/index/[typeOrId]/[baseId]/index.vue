<script setup lang="ts">
import {
  definePageMeta,
  extractSdkResponseErrorMsg,
  isDrawerOrModalExist,
  isMac,
  message,
  onBeforeMount,
  onBeforeUnmount,
  onKeyStroke,
  onMounted,
  ref,
  resolveComponent,
  useBase,
  useDialog,
  useI18n,
  useRoute,
  useRouter,
  useSidebar,
  useTheme,
} from '#imports'

definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

useTheme()

const { t } = useI18n()

const { $e } = useNuxtApp()

const route = useRoute()

const router = useRouter()

const baseStore = useBase()

const { loadProject } = baseStore

// create a new sidebar state
const { toggle, toggleHasSidebar } = useSidebar('nc-left-sidebar', { hasSidebar: true, isOpen: true })

const dropdownOpen = ref(false)

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
      // Base is not accessible
      message.error(t('msg.error.projectNotAccessible'))
      router.replace('/')
      return
    }
    message.error(await extractSdkResponseErrorMsg(e))
  }

  // if (route.name.toString().includes('baseType-baseId-index-index') && isUIAllowed('teamAndAuth')) {
  //   addTab({ id: TabType.AUTH, type: TabType.AUTH, title: t('title.teamAndAuth') })
  // }

  /** If v1 url found navigate to corresponding new url */
  const { type, name, view } = route.query
  if (type && name) {
    await router.replace(`/nc/${route.params.baseId}/${type}/${name}${view ? `/${view}` : ''}`)
  }
})

onMounted(() => {
  toggle(true)
  toggleHasSidebar(true)
})

onBeforeUnmount(() => {
  // clearTabs()
  // reset()
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
