<script setup lang="ts">
import { navigateTo, useDark, useRoute, useRouter, useSharedFormStoreOrThrow, useTheme, watch } from '#imports'

const { sharedViewMeta } = useSharedFormStoreOrThrow()

const isDark = useDark()

const { setTheme } = useTheme()

const route = useRoute()

const router = useRouter()

watch(
  () => sharedViewMeta.value.theme,
  (nextTheme) => {
    if (nextTheme) setTheme(nextTheme)
  },
  { immediate: true },
)

const onClick = () => {
  isDark.value = !isDark.value
}

const shouldRedirect = (to: string) => {
  if (sharedViewMeta.value.surveyMode) {
    if (!to.includes('survey')) navigateTo(`/nc/form/${route.params.viewId}/survey`)
  } else {
    if (to.includes('survey')) navigateTo(`/nc/form/${route.params.viewId}`)
  }
}

shouldRedirect(route.name as string)

router.afterEach((to) => shouldRedirect(to.name as string))
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

      .ant-btn {
        @apply dark:(bg-slate-300);
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
