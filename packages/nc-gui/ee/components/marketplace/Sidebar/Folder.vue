<script setup lang="ts">
const isFolderOpen = ref(true)
const folderContent = ref<HTMLElement>()

const toggleFolder = () => {
  isFolderOpen.value = !isFolderOpen.value
}

const onEnter = async (el: Element) => {
  const element = el as HTMLElement
  element.style.height = '0'
  element.style.opacity = '0'

  await nextTick()

  const height = element.scrollHeight
  element.style.height = `${height}px`
  element.style.opacity = '1'
}

const onLeave = (el: Element) => {
  const element = el as HTMLElement
  element.style.height = `${element.scrollHeight}px`
  element.style.opacity = '1'

  element.style.height = '0'
  element.style.opacity = '0'
}
</script>

<template>
  <div class="folder-container">
    <div
      class="flex px-3 py-1.5 cursor-pointer hover:bg-nc-bg-gray-light items-center rounded-lg justify-between transition-all duration-200"
      @click="toggleFolder"
    >
      <div class="text-nc-content-gray-muted text-caption font-semibold">
        <slot name="title" />
      </div>
      <Transition name="chevron-rotate" mode="out-in">
        <GeneralIcon
          :key="isFolderOpen ? 'open' : 'closed'"
          icon="ncChevronDown"
          :class="{
            'transform rotate-180': isFolderOpen,
          }"
          class="h-4 w-4 text-nc-content-gray-muted transition-all duration-300 ease-out"
        />
      </Transition>
    </div>

    <Transition name="folder-slide" @enter="onEnter" @leave="onLeave">
      <div v-if="isFolderOpen" ref="folderContent" class="folder-content overflow-hidden">
        <div class="flex flex-col">
          <slot />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
.folder-container {
  @apply select-none;

  .folder-content {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
}

.folder-slide-enter-active,
.folder-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: top;
}

.folder-slide-enter-from {
  opacity: 0;
  height: 0;
  transform: translateY(-10px);
}

.folder-slide-leave-to {
  opacity: 0;
  height: 0;
  transform: translateY(-5px);
}

.chevron-rotate-enter-active,
.chevron-rotate-leave-active {
  transition: all 0.2s ease-out;
}

.chevron-rotate-enter-from {
  opacity: 50%;
  transform: scale(0.8);
}

.chevron-rotate-leave-to {
  opacity: 0;
  transform: scale(1.1);
}
</style>
