<script lang="ts" setup>
import NcCreateBasePlaceholder from '~icons/nc-icons/create-base-placeholder'
import NcCreateBaseWithAiPlaceholder from '~icons/nc-icons/create-base-with-ai-placeholder'

interface Props {
  aiMode: boolean | null
}
const props = withDefaults(defineProps<Props>(), {})

const emit = defineEmits(['update:aiMode'])

const aiMode = useVModel(props, 'aiMode', emit)

const { isFeatureEnabled } = useBetaFeatureToggle()

onMounted(() => {
  if (!isFeatureEnabled(FEATURE_FLAG.AI_FEATURES)) {
    aiMode.value = false
  }
})
</script>

<template>
  <div v-if="isFeatureEnabled(FEATURE_FLAG.AI_FEATURES)" class="nc-create-base-wrapper">
    <div v-e="['c:base:create:scratch']" class="nc-create-base" @click="aiMode = false">
      <div class="nc-placeholder-icon-wrapper">
        <component :is="NcCreateBasePlaceholder" class="nc-placeholder-icon stroke-transparent" />
      </div>
      <div class="nc-create-base-content">
        <div class="nc-create-base-content-title">
          <GeneralIcon icon="plus" class="h-4 w-4 !text-nc-content-gray-subtle" />
          Start from scratch
        </div>
        <div class="nc-create-base-content-subtitle">Build your Base according to your specific requirements.</div>
      </div>
    </div>
    <div v-e="['c:base:ai:create']" class="nc-create-base-ai" @click="aiMode = true">
      <div class="nc-placeholder-icon-wrapper">
        <component :is="NcCreateBaseWithAiPlaceholder" class="nc-placeholder-icon stroke-transparent" />
      </div>
      <div class="nc-create-base-content">
        <div class="nc-create-base-content-title">
          <GeneralIcon icon="ncAutoAwesome" class="h-4 w-4 !text-nc-fill-purple-dark" />
          Build Base with AI
        </div>
        <div class="nc-create-base-content-subtitle">Quickly build your ideal Base with all tables, views and fields.</div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-create-base-wrapper {
  @apply flex gap-4;

  & > div {
    @apply rounded-xl flex flex-col border-1 w-[288px] overflow-hidden cursor-pointer transition-all;

    .nc-placeholder-icon-wrapper {
      @apply border-b-1 h-[180px] flex items-center justify-center;

      .nc-placeholder-icon {
        @apply flex-none;
      }
    }

    &.nc-create-base {
      @apply border-brand-200;

      &:hover {
        box-shadow: 0px 12px 16px -4px rgba(51, 102, 255, 0.12), 0px 4px 6px -2px rgba(51, 102, 255, 0.08);
      }

      .nc-placeholder-icon-wrapper {
        @apply border-brand-200 bg-nc-bg-brand;
      }
    }

    &.nc-create-base-ai {
      @apply border-purple-200;

      &:hover {
        box-shadow: 0px 12px 16px -4px rgba(125, 38, 205, 0.12), 0px 4px 6px -2px rgba(125, 38, 205, 0.08);
      }

      .nc-placeholder-icon-wrapper {
        @apply border-purple-200 bg-nc-bg-purple-light;
      }
    }

    .nc-create-base-content {
      @apply px-4 py-3 flex flex-col gap-2;

      .nc-create-base-content-title {
        @apply flex items-center gap-2 text-base text-nc-content-gray font-bold;
      }

      .nc-create-base-content-subtitle {
        @apply text-small leading-[18px] text-nc-content-gray-muted;
      }
    }
  }
}
</style>
