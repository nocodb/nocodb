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
    class="color-transition nc-form-view relative md:bg-primary bg-opacity-10 dark:(bg-slate-900) h-full min-h-[600px] flex flex-col justify-center items-center nc-form-signin"
  >
    <NuxtPage />

    <GeneralPoweredBy />

    <div
      class="flex items-center justify-center cursor-pointer absolute top-15 right-15 rounded-full p-2 bg-white dark:(bg-slate-600) shadow hover:(ring-1 ring-accent ring-opacity-100)"
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
    @apply w-full rounded p-2 min-h-[40px] flex items-center border-solid border-1 border-primary dark:border-slate-200;

    input {
      @apply dark:(bg-slate-300 text-slate-900);
    }
  }
}

.nc-cell {
  @apply dark:bg-slate-300;

  .nc-attachment-cell > div {
    @apply dark:(bg-slate-100);
  }
}
</style>
