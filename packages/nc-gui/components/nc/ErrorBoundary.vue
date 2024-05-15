<script lang="ts">
// modified version of default NuxtErrorBoundary component - https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/components/nuxt-error-boundary.ts
import { message } from 'ant-design-vue'

export default {
  emits: {
    error(_error: unknown) {
      return true
    },
  },
  setup(_props, { emit }) {
    const nuxtApp = useNuxtApp()
    const error = ref()
    const prevError = ref()
    const errModal = computed(() => !!error.value)
    const key = ref(0)
    const isErrorExpanded = ref(false)
    const { copy } = useCopy()

    onErrorCaptured((err) => {
      if (import.meta.client && (!nuxtApp.isHydrating || !nuxtApp.payload.serverRendered)) {
        console.error('UI Error :', err)
        emit('error', err)
        error.value = err
        return false
      }
    })

    const copyError = async () => {
      try {
        if (error.value) await copy(`message: ${error.value.message}\n\n${error.value.stack}`)
        message.info('Error message copied to clipboard.')
      } catch (e) {
        message.error('Something went wrong while copying to clipboard, please copy from browser console.')
      }
    }

    const reload = () => {
      prevError.value = error.value
      error.value = null
      key.value++
    }

    const navigateToHome = () => {
      prevError.value = error.value
      error.value = null
      location.hash = '/'
      location.reload()
    }

    return {
      errModal,
      error,
      key,
      isErrorExpanded,
      prevError,
      copyError,
      reload,
      navigateToHome,
    }
  },
}
</script>

<template>
  <slot :key="key"></slot>
  <slot name="error">
    <NcModal
      v-if="error"
      v-model:visible="errModal"
      :class="{ active: errModal }"
      :centered="true"
      :closable="false"
      :footer="null"
    >
      <div class="w-full flex flex-col gap-1">
        <h2 class="text-xl font-semibold">Oops! Something unexpected happened :/</h2>

        <p class="mb-0">
          <span
            >Please report this error in our
            <a href="https://discord.gg/5RgZmkW" target="_blank" rel="noopener noreferrer">Discord channel</a>. You can copy the
            error message by clicking the "Copy" button below.</span
          >
        </p>

        <span class="cursor-pointer" @click="isErrorExpanded = !isErrorExpanded"
          >{{ isErrorExpanded ? 'Hide' : 'Show' }} details
          <GeneralIcon
            icon="arrowDown"
            class="transition-transform transform duration-300"
            :class="{
              'rotate-180': isErrorExpanded,
            }"
        /></span>
        <div
          class="nc-error"
          :class="{
            active: isErrorExpanded,
          }"
        >
          <div class="nc-left-vertical-bar"></div>
          <div class="nc-error-content">
            <span class="font-weight-bold">Message: {{ error.message }}</span>
            <br />
            <div class="text-gray-500 mt-2">{{ error.stack }}</div>
          </div>
        </div>
        <div class="flex justify-end gap-2">
          <NcButton size="small" type="secondary" @click="copyError">
            <div class="flex items-center gap-1">
              <GeneralIcon icon="copy" />
              Copy Error
            </div>
          </NcButton>
          <NcButton v-if="!prevError || error.message !== prevError.message" size="small" @click="reload">
            <div class="flex items-center gap-1">
              <GeneralIcon icon="reload" />
              Reload
            </div>
          </NcButton>
          <NcButton v-else size="small" @click="navigateToHome">
            <div class="flex items-center gap-1">
              <GeneralIcon icon="link" />
              Home
            </div>
          </NcButton>
        </div>
      </div>
    </NcModal>
  </slot>
</template>

<style scoped lang="scss">
.nc-error {
  @apply flex gap-2 mb-2 max-h-0;
  white-space: pre;
  transition: max-height 300ms linear;

  &.active {
    max-height: 250px;
  }

  .nc-left-vertical-bar {
    @apply w-6px min-w-6px rounded min-h-full bg-gray-300;
  }

  .nc-error-content {
    @apply min-w-0 overflow-auto pl-2 flex-shrink;
  }
}
</style>
