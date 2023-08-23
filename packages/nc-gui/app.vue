<script setup lang="ts">
import { applyNonSelectable, computed, useRouter, useTheme } from '#imports'

const router = useRouter()

const route = router.currentRoute

const disableBaseLayout = computed(() => route.value.path.startsWith('/nc/view') || route.value.path.startsWith('/nc/form'))

useTheme()

applyNonSelectable()
useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
  if (cmdOrCtrl) {
    switch (e.key.toLowerCase()) {
      case 'a':
        // prevent Ctrl + A selection for non-editable nodes
        if (!['input', 'textarea'].includes((e.target as any).nodeName.toLowerCase())) {
          e.preventDefault()
        }
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
</script>

<template>
  <a-config-provider>
    <NuxtLayout :name="disableBaseLayout ? false : 'base'">
      <NuxtPage :key="key" :transition="false" />
    </NuxtLayout>
  </a-config-provider>
</template>
