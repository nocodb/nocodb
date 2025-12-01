<script setup lang="ts">
const { sharedViewMeta, sharedFormView, isAddingEmptyRowPermitted } = useSharedFormStoreOrThrow()

const route = useRoute()

const router = useRouter()

const shouldRedirect = (to: string) => {
  if (sharedViewMeta.value.surveyMode) {
    if (!to.includes('survey')) {
      navigateTo({
        path: `/nc/form/${route.params.viewId}/survey`,
        query: route.query,
      })
    }
  } else {
    if (to.includes('survey')) {
      navigateTo({
        path: `/nc/form/${route.params.viewId}`,
        query: route.query,
      })
    }
  }
}

shouldRedirect(route.name as string)

router.afterEach((to) => shouldRedirect(to.name as string))
</script>

<template>
  <div
    class="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-200 hover-scrollbar-thumb-gray-300 nc-h-screen overflow-y-auto overflow-x-hidden flex flex-col color-transition p-4 lg:p-6 nc-form-view min-h-[600px]"
    :class="{
      'children:(!h-auto my-auto)': sharedViewMeta?.surveyMode,
      'relative': !isAddingEmptyRowPermitted,
    }"
    :style="{
      background: parseProp(sharedFormView?.meta)?.background_color || 'var(--nc-bg-gray-extralight)',
    }"
  >
    <NuxtPage />

    <div v-if="!isAddingEmptyRowPermitted" class="nc-form-submission-restriction-overlay">
      <div class="nc-form-submission-restriction-modal">
        <div class="text-subHeading1 text-nc-content-gray font-bold">
          {{ $t('objects.permissions.formCannotAcceptSubmissions') }}
        </div>
        <div class="text-body text-nc-content-gray-subtle">
          {{ $t('objects.permissions.formCannotAcceptSubmissionsDescription') }}
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-form-submission-restriction-overlay {
  @apply !pointer-events-auto fixed inset-0 z-500 bg-black/15  grid place-items-center px-4;
  backdrop-filter: blur(1px);

  .nc-form-submission-restriction-modal {
    @apply p-6 rounded-2xl bg-nc-bg-default max-w-md flex flex-col gap-4;
    box-shadow: 0px 8px 8px -4px rgba(0, 0, 0, 0.04), 0px 20px 24px -4px rgba(0, 0, 0, 0.1);
  }
}
</style>

<style lang="scss">
.nc-form-view {
  .nc-data-cell {
    @apply !border-none rounded-none;

    &:focus-within {
      @apply !border-none;
    }
  }

  .nc-input {
    &:not(.layout-list) {
      &:not(:has(.form-attachment-cell.nc-has-attachments)) {
        @apply !bg-nc-bg-default rounded-lg border-solid border-1 border-nc-border-gray-medium !focus-within:border-nc-border-brand;
      }
    }
  }

  .nc-cell,
  .nc-virtual-cell {
    @apply bg-nc-bg-default appearance-none;

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
      @apply bg-nc-bg-default;

      &.nc-input {
        @apply w-full h-10;

        &:not(.layout-list) {
          @apply rounded-lg border-solid border-1 border-nc-border-gray-medium focus-within:border-nc-border-brand overflow-hidden;

          &.readonly {
            @apply bg-nc-bg-gray-extralight cursor-not-allowed;

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
          @apply h-auto !p-0 !bg-transparent !dark:bg-none;
        }

        .duration-cell-wrapper {
          @apply w-full;

          input {
            @apply !outline-none;

            &::placeholder {
              @apply text-nc-content-gray-disabled;
            }
          }
        }

        &:not(.readonly) {
          &:not(.nc-cell-longtext) {
            input,
            textarea,
            &.nc-virtual-cell {
              @apply bg-nc-bg-default !disabled:bg-transparent;
            }
          }
          &.nc-cell-longtext {
            textarea {
              @apply bg-nc-bg-default !disabled:bg-transparent;
            }
          }
        }

        &.layout-list > div {
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
        &.nc-cell:not(.nc-cell-longtext) {
          @apply p-2;

          &.nc-cell-phonenumber,
          &.nc-cell-email,
          &.nc-cell-url {
            .nc-cell-field.nc-cell-link-preview {
              @apply px-3;
            }
          }

          &.nc-cell-attachment {
            @apply pl-1;
          }
        }
        &.nc-virtual-cell {
          @apply px-2 py-1;
        }

        &.nc-cell-json {
          & > div {
            @apply w-full;
          }
        }

        .ant-picker,
        input.nc-cell-field {
          @apply !py-0 !px-1;
        }
        &.nc-cell-currency {
          @apply !py-0 !pl-0 flex items-stretch;

          .nc-currency-code {
            @apply !bg-nc-bg-gray-light;
          }
        }
        &.nc-cell-attachment {
          @apply h-auto;
        }
      }
    }
  }
}
</style>
