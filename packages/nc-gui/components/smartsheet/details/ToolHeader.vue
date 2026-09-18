<script lang="ts" setup>
// Title band — identical on every tool screen (the page contract):
//   [← Back] | [icon] Title            [Docs ↗] [secondary] [primary]
// The page title appears here exactly once; tools must not echo it in the body.
interface Props {
  icon: string
  title: string
  docsHref?: string
}

defineProps<Props>()

const emits = defineEmits<{ back: [] }>()
</script>

<template>
  <div
    class="flex-none flex items-center gap-2 pl-3 pr-4 h-[var(--toolbar-height)] min-h-[var(--toolbar-height)] border-b-1 border-nc-border-gray-medium"
    data-testid="nc-tool-header"
  >
    <NcButton
      v-e="['c:table:tools:back-to-grid']"
      size="small"
      type="text"
      data-testid="nc-tools-back-to-grid"
      @click="emits('back')"
    >
      <div class="flex items-center gap-1.5 text-nc-content-brand">
        <GeneralIcon icon="ncArrowLeft" class="h-4 w-4" />
        {{ $t('general.back') }}
      </div>
    </NcButton>

    <div class="w-px h-5 bg-nc-border-gray-medium flex-none" />

    <span class="flex-none w-6 h-6 rounded-md bg-nc-bg-brand flex items-center justify-center text-nc-content-brand">
      <GeneralIcon :icon="icon" class="!h-3.5 !w-3.5" />
    </span>
    <div class="text-base font-semibold text-nc-content-gray-extreme truncate">{{ title }}</div>

    <div class="ml-auto flex items-center gap-2.5 flex-none">
      <a
        v-if="docsHref"
        :href="docsHref"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1.5 text-bodyDefaultSm font-semibold text-nc-content-gray-subtle hover:text-nc-content-brand !no-underline"
      >
        {{ $t('title.docs') }}
        <GeneralIcon icon="ncExternalLink" class="!h-3.5 !w-3.5" />
      </a>
      <slot name="actions" />
    </div>
  </div>
</template>
