<script setup lang="ts">
import { applyNonSelectable, computed, useCommandPalette, useRouter, useTheme } from '#imports'

const router = useRouter()

const route = $(router.currentRoute)

const disableBaseLayout = computed(() => route.path.startsWith('/nc/view') || route.path.startsWith('/nc/form'))

useTheme()

const { cmdPalette, cmdData, cmdPlaceholder, cmdOnSelected, cmdOnChange, activeScope } = useCommandPalette()

applyNonSelectable()

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

function hookFunction(object: any, functionName: string, callback: Function) {
  ;(function (originalFunction) {
    object[functionName] = function (...args: any) {
      const returnValue = originalFunction.apply(this, args)

      callback.apply(this, [returnValue, originalFunction, args])

      return returnValue
    }
  })(object[functionName])
}

onMounted(() => {
  if (!cmdPalette.value) return
  hookFunction(cmdPalette.value, 'open', () => {
    if (activeScope.value === 'disabled') {
      cmdPalette.value?.close()
      return
    }
    cmdPalette.value?.setParent(activeScope.value)
  })
})
</script>

<template>
  <a-config-provider>
    <NuxtLayout :name="disableBaseLayout ? false : 'base'">
      <NuxtPage :key="key" :transition="false" />
    </NuxtLayout>
  </a-config-provider>
  <ninja-keys
    ref="cmdPalette"
    :data="cmdData"
    :placeholder="cmdPlaceholder"
    @selected="cmdOnSelected"
    @change="cmdOnChange"
  ></ninja-keys>
</template>
