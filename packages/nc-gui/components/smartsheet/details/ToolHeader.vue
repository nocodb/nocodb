<script lang="ts" setup>
interface Props {
  icon: string
  title: string
  docsHref?: string
}

defineProps<Props>()
</script>

<template>
  <div
    class="flex-none flex items-center gap-2.5 px-5 h-[var(--toolbar-height)] min-h-[var(--toolbar-height)] border-b-1 border-nc-border-gray-light"
    data-testid="nc-tool-header"
  >
    <span class="flex-none w-6 h-6 rounded-md bg-nc-bg-brand flex items-center justify-center text-nc-content-brand">
      <GeneralIcon :icon="icon" class="!h-3.5 !w-3.5" />
    </span>
    <div class="flex-1 min-w-0">
      <div class="text-base font-semibold text-nc-content-gray-extreme truncate">{{ title }}</div>
    </div>
    <div class="flex items-center gap-2.5 flex-none">
      <a
        v-if="docsHref"
        :href="docsHref"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1.5 text-bodyDefaultSm font-semibold text-nc-content-gray-subtle hover:text-nc-content-brand !no-underline"
      >
        <GeneralIcon icon="ncBookOpen" class="!h-4 !w-4" />
        {{ $t('title.docs') }}
      </a>
      <slot name="actions" />
    </div>
  </div>
</template>
