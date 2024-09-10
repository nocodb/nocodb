<script lang="ts" setup>
</script>

<template>
  <div class="nc-ai-wizard-card rounded-2xl overflow-hidden">
    <div class="nc-ai-wizard-card-content-wrapper">
      <div>
        <slot name="icon">
          <GeneralIcon icon="ncAutoAwesome" class="flex-none !text-nc-fill-purple-dark" />
        </slot>
      </div>
      <div class="nc-ai-wizard-card-content">
        <div v-if="$slots.title" class="nc-ai-wizard-card-content-title">
          <slot name="title"> </slot>
        </div>
        <div v-if="$slots.title" class="nc-ai-wizard-card-content-subtitle">
          <slot name="subtitle"></slot>
        </div>

        <div v-if="$slots.title" class="nc-ai-wizard-card-content-tags">
          <slot name="tags"></slot>
        </div>
      </div>
    </div>
    <div class="nc-ai-wizard-card-footer">
      <slot name="footerWrapper">
        <div class="nc-ai-wizard-card-footer-branding text-nc-content-purple-dark text-xs">
          Powered by
          <a class="!no-underline font-semibold !text-inherit"> Noco AI </a>
        </div>
        <slot name="settings">
          <NcButton size="xs" class="!px-1 hover:!bg-purple-200 !text-nc-content-purple-dark" type="text">
            <GeneralIcon icon="settings" />
          </NcButton>
        </slot>
        <slot name="footer"></slot>
      </slot>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-ai-wizard-card {
  .nc-ai-wizard-card-content-wrapper {
    @apply p-4 flex gap-4 bg-nc-bg-purple-light;
    .nc-ai-wizard-card-content {
      @apply flex flex-col gap-3;

      .nc-ai-wizard-card-content-title {
        @apply text-base font-weight-700 text-nc-content-purple-dark;
      }

      .nc-ai-wizard-card-content-subtitle {
        @apply text-sm text-nc-content-gray-subtle2;
      }

      .nc-ai-wizard-card-content-tags {
        @apply flex flex-wrap gap-2;
      }
    }
  }

  .nc-ai-wizard-card-footer {
    @apply px-4 py-2 bg-nc-bg-purple-dark flex items-center gap-3;
  }
}
</style>
