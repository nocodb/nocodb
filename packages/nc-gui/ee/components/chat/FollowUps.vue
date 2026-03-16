<script setup lang="ts">
interface Props {
  suggestions: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [text: string]
}>()

const { t } = useI18n()
</script>

<template>
  <div v-if="props.suggestions.length" class="nc-chat-followups">
    <!-- Follow-ups -->
    <div class="text-captionSm text-nc-content-gray-muted mt-2 mb-1.5">
      {{ t('labels.followUps') }}
    </div>
    <div class="flex flex-col">
      <div
        v-for="(suggestion, index) in props.suggestions"
        :key="index"
        v-e="['c:chat:followup-click']"
        class="py-2.5 border-b-1 border-nc-border-gray-light cursor-pointer text-bodyDefaultSm text-nc-content-gray-subtle"
        @click="emit('select', suggestion)"
      >
        {{ suggestion }}
      </div>
    </div>
  </div>
</template>
