<script setup lang="ts">
import ErrorBoundary from './components/nc/ErrorBoundary.vue'

const router = useRouter()

const route = router.currentRoute

const disableBaseLayout = computed(() => route.value.path.startsWith('/nc/view') || route.value.path.startsWith('/nc/form'))

useTheme()

const { isExperimentalFeatureModalOpen, initializeFeatures } = useBetaFeatureToggle()

initializeFeatures()

const { commandPalette, cmdData, cmdPlaceholder, activeScope, loadTemporaryScope } = useCommandPalette()

const { cmdK, cmdL, cmdJ, setActiveCmdView } = useCommand()

applyNonSelectable()

const { chatwootInit } = useProvideChatwoot()

onMounted(() => {
  window.addEventListener('chatwoot:ready', chatwootInit)
})

onBeforeUnmount(() => {
  window.removeEventListener('chatwoot:ready', chatwootInit)
})

useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
  if (cmdOrCtrl) {
    switch (e.key.toLowerCase()) {
      case 'a':
        // prevent Ctrl + A selection for non-editable nodes
        if (!['input', 'textarea'].includes((e.target as any).nodeName.toLowerCase())) {
          e.preventDefault()
        }
        break
      case 'k':
        e.preventDefault()
        commandPalette.value?.open?.()
        break
      case 'l':
        e.preventDefault()
        break
      case 'j':
        e.preventDefault()
        break
    }
  }
})

// TODO: Remove when https://github.com/vuejs/core/issues/5513 fixed
const key = ref(0)

const messages = [
  `Uncaught NotFoundError: Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node.`, // chromium based
  `NotFoundError: The object can not be found here.`, // safari
  "Cannot read properties of null (reading 'parentNode')",
]

if (typeof window !== 'undefined') {
  // @ts-expect-error using arbitrary window key
  if (!window.__ncvue) {
    window.addEventListener('error', (event) => {
      if (messages.includes(event.message)) {
        event.preventDefault()
        console.warn('Re-rendering layout because of https://github.com/vuejs/core/issues/5513')
        key.value++
      }
    })
  }

  // @ts-expect-error using arbitrary window key
  window.__ncvue = true
}

function onScope(scope: string) {
  if (scope === 'root' && isEeUI) {
    loadTemporaryScope({ scope: 'root', data: {} })
  }
}

// ref: https://github.com/vuejs/vue-cli/issues/7431#issuecomment-1793385162
// Stop error resizeObserver
const debounce = (callback: (...args: any[]) => void, delay: number) => {
  let tid: any
  return function (...args: any[]) {
    const ctx = self
    tid && clearTimeout(tid)
    tid = setTimeout(() => {
      callback.apply(ctx, args)
    }, delay)
  }
}

const _ = (window as any).ResizeObserver
;(window as any).ResizeObserver = class ResizeObserver extends _ {
  constructor(callback: (...args: any[]) => void) {
    callback = debounce(callback, 20)
    super(callback)
  }
}
</script>

<template>
  <a-config-provider>
    <NuxtLayout :name="disableBaseLayout ? false : 'base'">
      <ErrorBoundary>
        <NuxtPage :key="key" :transition="false" />
      </ErrorBoundary>
    </NuxtLayout>
  </a-config-provider>

  <ErrorBoundary>
    <div>
      <!-- Page Loading Indicator -->
      <NcNuxtLoadingIndicator />

      <!-- Command Menu -->
      <CmdK
        ref="commandPalette"
        v-model:open="cmdK"
        :scope="activeScope.scope"
        :data="cmdData"
        :placeholder="cmdPlaceholder"
        :load-temporary-scope="loadTemporaryScope"
        :set-active-cmd-view="setActiveCmdView"
        @scope="onScope"
      />
      <!-- Recent Views. Cycles through recently visited Views -->
      <CmdL v-model:open="cmdL" :set-active-cmd-view="setActiveCmdView" />
      <!-- Documentation. Integrated NocoDB Docs directly inside the Product -->
      <CmdJ v-model:open="cmdJ" :set-active-cmd-view="setActiveCmdView" />
      <DashboardFeatureExperimentation v-model:value="isExperimentalFeatureModalOpen" />
    </div>
  </ErrorBoundary>
</template>
