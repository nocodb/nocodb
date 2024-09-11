<script lang="ts" setup>
interface Props {
  isDisabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isDisabled: false,
})

const emits = defineEmits(['update:isDisabled'])

const vIsDisabled = useVModel(props, 'isDisabled', emits)

const {} = toRefs(props)

const workspaceStore = useWorkspace()

const { activeWorkspaceId } = storeToRefs(workspaceStore)
</script>

<template>
  <div
    class="nc-ai-wizard-card rounded-2xl overflow-hidden transition-colors"
    :class="{
      'is-disabled': isDisabled,
    }"
  >
    <div
      class="nc-ai-wizard-card-content"
      :class="{
        'min-h-[132px]': !isDisabled,
      }"
    >
      <div class="nc-ai-wizard-card-content-title-wrapper">
        <slot name="icon">
          <GeneralIcon icon="ncAutoAwesome" class="flex-none !text-current" />
        </slot>
        <div v-if="$slots.title" class="nc-ai-wizard-card-content-title flex-1">
          <slot name="title"> </slot>
        </div>

        <div class="nc-ai-wizard-card-content-title-action -mt-0.5">
          <slot name="titleAction">
            <NcButton v-if="isDisabled" type="text" size="xs" @click="vIsDisabled = false">
              <div class="flex items-center gap-2">
                {{ $t('general.enable') }}
                <GeneralIcon icon="chevronDown" />
              </div>
            </NcButton>
            <NcButton v-else type="text" size="xs" class="!px-1 !text-current" @click="vIsDisabled = true">
              <GeneralIcon icon="close" />
            </NcButton>
          </slot>
        </div>
      </div>
      <template v-if="!isDisabled">
        <div v-if="$slots.subtitle" class="nc-ai-wizard-card-content-subtitle pl-10">
          <slot name="subtitle"></slot>
        </div>

        <div v-if="$slots.tags" class="nc-ai-wizard-card-content-tags pl-10">
          <slot name="tags"></slot>
        </div>
      </template>
    </div>

    <div class="nc-ai-wizard-card-footer">
      <slot name="footerWrapper">
        <div class="nc-ai-wizard-card-footer-branding text-xs">
          Powered by
          <a class="!no-underline font-semibold !text-inherit"> Noco AI </a>
        </div>
        <slot name="settings">
          <AiSettings :settings="{}" :workspace-id="activeWorkspaceId" placement="bottomLeft">
            <NcButton size="xs" class="nc-ai-wizard-card-footer-settings !px-1 !text-current" type="text">
              <GeneralIcon icon="settings" />
            </NcButton>
          </AiSettings>
        </slot>
        <slot v-if="!isDisabled" name="footer"></slot>
      </slot>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-ai-wizard-card {
  .nc-ai-wizard-card-content {
    @apply p-4 flex flex-col gap-3 bg-nc-bg-purple-light;

    .nc-ai-wizard-card-content-title-wrapper {
      @apply flex justify-between gap-4 text-nc-content-purple-dark;
    }

    .nc-ai-wizard-card-content-title {
      @apply text-base font-weight-700;
    }

    .nc-ai-wizard-card-content-subtitle {
      @apply text-sm text-nc-content-gray-subtle2;
    }

    .nc-ai-wizard-card-content-tags {
      @apply flex flex-wrap gap-2;
    }
  }

  .nc-ai-wizard-card-footer {
    @apply px-4 py-2 text-nc-content-purple-dark bg-nc-bg-purple-dark flex items-center gap-3;

    .nc-ai-wizard-card-footer-settings {
      @apply hover:!bg-purple-200;
    }
  }

  &.is-disabled {
    .nc-ai-wizard-card-content {
      @apply bg-nc-bg-gray-extralight;

      .nc-ai-wizard-card-content-title-wrapper {
        @apply text-nc-content-gray-subtle2;
      }

      .nc-ai-wizard-card-content-subtitle {
        @apply text-nc-content-gray-subtle2;
      }
    }

    .nc-ai-wizard-card-footer {
      @apply text-nc-content-gray-subtle2 bg-nc-bg-gray-light;

      .nc-ai-wizard-card-footer-settings {
        @apply hover:!bg-gray-100;
      }
    }
  }
}
</style>
