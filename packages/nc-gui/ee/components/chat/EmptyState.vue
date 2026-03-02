<script setup lang="ts">
const emit = defineEmits<{
  prompt: [text: string]
}>()

const { t } = useI18n()

const starterPrompts = computed(() => [
  t('msg.chat.starterDescribe'),
  t('msg.chat.starterRecords'),
  t('msg.chat.starterFilter'),
])
</script>

<template>
  <div class="flex flex-col items-center justify-center h-full px-6 py-8">
    <GeneralIcon icon="ncMessageSquare" class="w-12 h-12 text-nc-content-gray-subtle mb-4" />

    <h3 class="text-lg font-semibold text-nc-content-gray-emphasis mb-1">
      {{ t('labels.chatWith') }}
    </h3>

    <p class="text-sm text-nc-content-gray-subtle mb-6">
      {{ t('placeholder.askAnything') }}
    </p>

    <div class="flex flex-col gap-2 w-full max-w-sm">
      <button
        v-for="prompt in starterPrompts"
        :key="prompt"
        v-e="['c:chat:starter-prompt']"
        class="text-left text-sm px-4 py-2.5 rounded-lg border-1 border-nc-border-gray-light bg-nc-bg-default text-nc-content-gray-emphasis hover:bg-nc-bg-gray-light hover:border-nc-border-gray-medium transition-colors cursor-pointer"
        @click="emit('prompt', prompt)"
      >
        {{ prompt }}
      </button>
    </div>
  </div>
</template>
