<script setup lang="ts">
definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const { t } = useI18n()

const { $e } = useNuxtApp()

const route = useRoute()

const router = useRouter()

const baseStore = useBase()

const { loadProject } = baseStore

const { base, isSharedBase } = storeToRefs(baseStore)

provide(ProjectInj, base)

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

    const error = await extractSdkResponseErrorMsgv2(e)

    message.error(error.message)

    if (error.error === NcErrorType.ERR_BASE_NOT_FOUND) {
      navigateTo({ name: 'index-typeOrId', params: { typeOrId: 'nc' } })
      return
    }
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

/**
 * `?settings={slug}` is what opens the base settings shell over this route.
 *
 * Only a slug the nav actually knows counts — `?settings` is not ours alone
 * (the agent page drives its own panel off `?settings=true`), so an unknown
 * value has to mean "not for us" rather than falling back to a pane.
 */
const settingsTab = computed(() => {
  // A shared-base visitor has no settings to reach: every row is gated off and
  // the shell would open on an empty rail.
  if (isSharedBase.value) return null

  return resolveBaseSettingsTab(route.query.settings)
})
</script>

<template>
  <div class="h-full">
    <div class="h-full">
      <NuxtPage />
    </div>

    <!-- Base settings opens over whatever base route is active, so the table or
         view underneath stays mounted and closing lands you back on it. -->
    <LazyProjectSettingsShell v-if="settingsTab" :tab="settingsTab" />
  </div>
</template>

<style lang="scss" scoped>
:global(#nc-sidebar-left .ant-layout-sider-collapsed) {
  @apply !w-0 !max-w-0 !min-w-0 overflow-x-hidden;
}

.nc-left-sidebar {
  .nc-sidebar-left-toggle-icon {
    @apply opacity-0 transition-opacity duration-200 transition-colors text-nc-content-gray-muted/80 hover:text-nc-content-gray-muted/100;

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
