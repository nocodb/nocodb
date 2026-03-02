<script setup lang="ts">
interface Props {
  question: string
  options: string[]
}

defineProps<Props>()

const emits = defineEmits<{
  select: [choice: string]
  skip: []
}>()

const { t } = useI18n()

const customInput = ref('')

const handleCustomSubmit = () => {
  const trimmed = customInput.value.trim()
  if (!trimmed) return
  emits('select', trimmed)
}
</script>

<template>
  <div class="nc-chat-options bg-nc-bg-default border-1 border-nc-border-gray-medium rounded-xl overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2.5">
      <span class="text-sm font-medium text-nc-content-gray-emphasis leading-snug flex-1 mr-2">{{ question }}</span>
      <NcButton size="xxsmall" type="text" class="!text-nc-content-gray-muted flex-none" @click="emits('skip')">
        <GeneralIcon icon="close" class="w-3.5 h-3.5" />
      </NcButton>
    </div>

    <div class="border-t-1 border-nc-border-gray-light" />

    <!-- Options -->
    <div>
      <div
        v-for="(option, i) in options"
        :key="i"
        class="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-nc-bg-gray-light transition-colors"
        @click="emits('select', option)"
      >
        <span
          class="flex-none w-7 h-7 flex items-center justify-center rounded-lg bg-nc-bg-gray-extralight text-xs font-semibold text-nc-content-gray-subtle border-1 border-nc-border-gray-light"
        >
          {{ i + 1 }}
        </span>
        <span class="text-sm text-nc-content-gray-emphasis">{{ option }}</span>
      </div>
    </div>

    <div class="border-t-1 border-nc-border-gray-light" />

    <!-- Footer: custom input + skip -->
    <div class="flex items-center gap-2 px-3 py-2">
      <GeneralIcon icon="ncEdit" class="flex-none w-4 h-4 text-nc-content-gray-muted" />
      <input
        v-model="customInput"
        class="flex-1 text-sm text-nc-content-gray-emphasis bg-transparent outline-none placeholder:text-nc-content-gray-muted min-w-0"
        :placeholder="t('placeholder.somethingElse')"
        @keydown.enter.prevent="handleCustomSubmit"
      />
      <NcButton v-if="customInput.trim()" size="xxsmall" type="primary" @click="handleCustomSubmit">
        {{ t('general.send') }}
      </NcButton>
      <NcButton v-else size="xxsmall" type="text" class="!text-nc-content-gray-subtle" @click="emits('skip')">
        {{ t('general.skip') }}
      </NcButton>
    </div>
  </div>
</template>
