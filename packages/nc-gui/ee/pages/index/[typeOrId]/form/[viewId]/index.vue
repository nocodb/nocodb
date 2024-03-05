<script setup lang="ts">
import { navigateTo, useDark, useRoute, useRouter, useSharedFormStoreOrThrow } from '#imports'

const { sharedViewMeta, sharedFormView } = useSharedFormStoreOrThrow()

const isDark = useDark()

const route = useRoute()

const router = useRouter()

onMounted(() => {
  isDark.value = false
})

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
    class="scrollbar-thin-dull h-[100vh] overflow-y-auto overflow-x-hidden flex flex-col color-transition p-4 lg:p-10 nc-form-view relative min-h-[600px]"
    :style="{
      background: parseProp(sharedFormView?.meta)?.background_color || '#F9F9FA',
    }"
  >
    <NuxtPage />
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
  .nc-data-cell {
    @apply !border-none rounded-none;

    &:focus-within {
      @apply !border-none;
    }
  }

  .nc-cell {
    @apply bg-white dark:bg-slate-500 appearance-none;

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
        @apply w-full;

        &:not(.layout-list) {
          @apply rounded-lg border-solid border-1 border-gray-200 focus-within:border-brand-500 overflow-hidden;

          &.readonly {
            @apply bg-gray-50 cursor-not-allowed;

            input,
            textarea {
              @apply !bg-transparent;
            }
          }

          & > div {
            @apply !bg-transparent;
          }
        }
        &.layout-list {
          @apply h-auto !pl-0 !py-1 !bg-transparent !dark:bg-none;
        }

        .duration-cell-wrapper {
          @apply w-full;

          input {
            @apply !outline-none;

            &::placeholder {
              @apply text-gray-400 dark:text-slate-300;
            }
          }
        }

        &:not(.readonly) {
          input,
          textarea,
          &.nc-virtual-cell {
            @apply bg-white !disabled:bg-transparent;
          }
        }

        input,
        textarea,
        &.nc-virtual-cell {
          .ant-btn {
            @apply dark:(bg-slate-300);
          }

          .chip {
            @apply dark:(bg-slate-700 text-white);
          }
        }

        &.layout-list > div {
          .ant-btn {
            @apply dark:(bg-slate-300);
          }

          .chip {
            @apply dark:(bg-slate-700 text-white);
          }
        }

        &.nc-cell-longtext {
          @apply p-0 h-auto;
          & > div {
            @apply w-full;
          }
          &.readonly > div {
            @apply px-3 py-1;
          }

          textarea {
            @apply px-3;
          }
        }
        &:not(.nc-cell-longtext) {
          @apply p-2;
        }

        &.nc-cell-json {
          @apply h-auto;
          & > div {
            @apply w-full;
          }
        }

        .ant-picker,
        input.nc-cell-field {
          @apply !py-0 !px-1;
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
