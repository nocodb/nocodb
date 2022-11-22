<script setup lang="ts">
import { computed, useRoute, useTheme } from '#imports'

const route = useRoute()

const disableBaseLayout = computed(() => route.path.startsWith('/nc/view') || route.path.startsWith('/nc/form'))

useTheme()

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
      <NuxtPage :key="key" />
    </NuxtLayout>
  </a-config-provider>
</template>
