<script setup lang="ts">
import { useDark, useRoute, useSharedFormStoreOrThrow, useTheme, watch } from '#imports'

const { passwordDlg, password, loadSharedView } = useSharedFormStoreOrThrow()

const route = useRoute()

const isDark = useDark()

const { setTheme } = useTheme()

watch(
  () => route.query.theme,
  (nextTheme) => {
    if (nextTheme) {
      const theme = (nextTheme as string).split(',').map((t) => t.trim() && `#${t}`)

      setTheme({
        primaryColor: theme[0],
        accentColor: theme[1],
      })
    }
  },
  { immediate: true },
)

const onClick = () => {
  isDark.value = !isDark.value
}
</script>

<template>
  <div
    class="overflow-y-auto overflow-x-hidden flex flex-wrap color-transition nc-form-view relative bg-primary bg-opacity-10 dark:(bg-slate-900) h-full min-h-[600px]"
  >
    <NuxtPage />

    <div class="flex w-full items-end mt-12">
      <GeneralPoweredBy />
    </div>

    <div
      class="color-transition flex items-center justify-center cursor-pointer absolute top-4 md:top-15 right-4 md:right-15 rounded-full p-2 bg-white dark:(bg-slate-600) shadow hover:(ring-1 ring-accent ring-opacity-100)"
      @click="onClick"
    >
      <Transition name="slide-left" duration="250" mode="out-in">
        <MaterialSymbolsDarkModeOutline v-if="isDark" />
        <MaterialSymbolsLightModeOutline v-else />
      </Transition>
    </div>

    <a-modal
      v-model:visible="passwordDlg"
      :closable="false"
      width="28rem"
      centered
      :footer="null"
      :mask-closable="false"
      wrap-class-name="nc-modal-shared-form-password-dlg"
      @close="passwordDlg = false"
    >
      <div class="w-full flex flex-col">
        <a-typography-title :level="4">This shared view is protected</a-typography-title>

        <a-form ref="formRef" :model="{ password }" class="mt-2" @finish="loadSharedView">
          <a-form-item name="password" :rules="[{ required: true, message: $t('msg.error.signUpRules.passwdRequired') }]">
            <a-input-password v-model:value="password" :placeholder="$t('msg.info.signUp.enterPassword')" />
          </a-form-item>

          <!-- Unlock -->
          <a-button type="primary" html-type="submit">{{ $t('general.unlock') }}</a-button>
        </a-form>
      </div>
    </a-modal>
  </div>
</template>

<style lang="scss">
html,
body,
h1,
h2,
h3,
h4,
h5,
h6,
p {
  @apply dark:text-white color-transition;
}

.nc-form-view {
  .nc-input {
    @apply w-full rounded p-2 min-h-[40px] flex items-center border-solid border-1 border-gray-300 dark:border-slate-200;

    input,
    &.nc-virtual-cell,
    > div {
      @apply bg-white dark:(bg-slate-500 text-white);

      .nc-icon {
        @apply dark:text-slate-900;
      }

      .chip {
        @apply dark:(bg-slate-700 text-white);
      }
    }
  }
}

.nc-cell {
  @apply bg-white dark:bg-slate-500;

  .nc-attachment-cell > div {
    @apply dark:(bg-slate-100);
  }
}

.nc-form-column-label {
  > * {
    @apply dark:text-slate-300;
  }
}
</style>
