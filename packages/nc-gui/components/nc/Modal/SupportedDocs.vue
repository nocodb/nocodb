<script lang="ts" setup>
interface Props {
  docs: SupportedDocsType[]
}

withDefaults(defineProps<Props>(), {
  docs: () => [],
})
</script>

<template>
  <div class="w-full flex flex-col gap-3">
    <div class="text-sm text-nc-content-gray font-semibold">
      <slot name="title">Support Docs</slot>
    </div>

    <div>
      <div v-for="(doc, idx) of docs" :key="idx" class="flex items-center gap-1">
        <div class="h-7 w-7 flex items-center justify-center">
          <GeneralIcon icon="bookOpen" class="flex-none w-4 h-4 text-nc-content-gray-subtle2" />
        </div>
        <a
          :href="doc.href"
          target="_blank"
          rel="noopener noreferrer"
          class="!text-nc-content-gray-subtle text-sm !no-underline !hover:underline"
        >
          {{ doc.title }}
        </a>
      </div>
    </div>
  </div>
</template>
