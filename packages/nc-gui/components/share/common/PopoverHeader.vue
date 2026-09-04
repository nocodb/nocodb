<script lang="ts" setup>
interface Props {
  title: string
  showBack?: boolean
}

withDefaults(defineProps<Props>(), {
  showBack: false,
})

const emits = defineEmits<{
  (e: 'back'): void
}>()
</script>

<template>
  <div class="flex items-center gap-2 px-4 pt-3 pb-3 select-none">
    <button
      v-if="showBack"
      v-e="['c:share:popover:back']"
      type="button"
      class="flex items-center justify-center h-6 w-6 rounded hover:bg-nc-bg-gray-light text-nc-content-gray-subtle2 -ml-1"
      data-testid="nc-share-popover-back"
      @click="emits('back')"
    >
      <GeneralIcon icon="ncArrowLeft" class="!w-4 !h-4" />
    </button>
    <div class="text-nc-content-gray-emphasis font-semibold text-base truncate">
      {{ title }}
    </div>
  </div>
</template>
