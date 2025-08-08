<script setup lang="ts">
import { useEventListener } from '@vueuse/core'

interface Props {
  srcs: string[]
  alt?: string
  objectFit?: string
  isCellPreview?: boolean
  imageClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  isCellPreview: true,
  imageClass: '',
})
const emit = defineEmits(['error'])

const index = ref(0)

const onError = async () => {
  index.value++
  if (index.value >= props.srcs.length) {
    const isURLExp = await isURLExpired(props.srcs[0])
    if (isURLExp.isExpired) {
      emit('error')
    }
  }
}

</script>

<template>
  <div class="relative h-full w-full">
    <div
      ref="containerRef"
      class="h-full w-full overflow-hidden"
      :class="{
        'flex items-center justify-center': index >= props.srcs?.length,
      }"
    >
      <img
        v-if="index < props.srcs?.length"
        ref="imageRef"
        :src="props.srcs[index]"
        :alt="props?.alt || ''"
        :class="[imageClass, { '!object-contain': props.objectFit === 'contain' }]"
        class="m-auto h-full max-h-full w-auto nc-attachment-image object-cover origin-center"
        loading="lazy"
        @error="onError"
      />
      <GeneralIcon v-else icon="ncFileTypePdf" class="flex-none w-6" />
    </div>
  </div>
</template>
