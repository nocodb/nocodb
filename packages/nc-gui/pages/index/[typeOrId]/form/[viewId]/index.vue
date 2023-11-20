<script setup lang="ts">
import { navigateTo, useDark, useRoute, useRouter, useSharedFormStoreOrThrow, useTheme, watch } from '#imports'

const { sharedViewMeta } = useSharedFormStoreOrThrow()

const isDark = useDark()

const { setTheme } = useTheme()

const route = useRoute()

const router = useRouter()

watch(
  () => sharedViewMeta.value.withTheme,
  (hasTheme) => {
    if (hasTheme && sharedViewMeta.value.theme) setTheme(sharedViewMeta.value.theme)
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
    class="scrollbar-thin-dull overflow-y-auto overflow-x-hidden flex flex-col color-transition nc-form-view relative bg-primary bg-opacity-10 dark:(bg-slate-900) h-[100vh] min-h-[600px] py-4"
  >
    <NuxtPage />

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
  .nc-cell {
    @apply bg-white dark:bg-slate-500;

    &.nc-cell-checkbox {
      @apply color-transition !border-0;

      .nc-icon {
        @apply !text-2xl;
      }

      .nc-cell-hover-show {
        opacity: 100 !important;

        div {
          background-color: transparent !important;
        }
      }
    }

    &:not(.nc-cell-checkbox) {
      @apply bg-white dark:bg-slate-500;

      &.nc-input {
        @apply w-full rounded p-2 min-h-[40px] flex items-center border-solid border-1 border-gray-300 dark:border-slate-200;

        .duration-cell-wrapper {
          @apply w-full;

          input {
            @apply !outline-none;

            &::placeholder {
              @apply text-gray-400 dark:text-slate-300;
            }
          }
        }

        input,
        textarea,
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

        textarea {
          @apply px-4 py-2 rounded;

          &:focus {
            box-shadow: none !important;
          }
        }
      }
    }

    .nc-attachment-cell > div {
      @apply dark:(bg-slate-100);
    }
  }
}

.nc-form-column-label {
  > * {
    @apply dark:text-slate-300;
  }
}
</style>
