<script setup lang="ts">
const { isUpdatingAutomation } = storeToRefs(useAutomationStore())

const { isEditorOpen, isCreateEditScriptAllowed } = useScriptStoreOrThrow()

const displayText = ref()
const showSaved = ref(false)
let savingInterval: NodeJS.Timeout | null = null
let savedTimeout: NodeJS.Timeout | null = null

const startSavingAnimation = () => {
  const texts = ['Saving', 'Saving.', 'Saving..', 'Saving...']
  let index = 0

  displayText.value = texts[0] as string

  savingInterval = setInterval(() => {
    index = (index + 1) % texts.length
    displayText.value = texts[index] as string
  }, 500)
}

const stopSavingAnimation = () => {
  if (savingInterval) {
    clearInterval(savingInterval)
    savingInterval = null
  }

  displayText.value = 'Saved'
  showSaved.value = true

  savedTimeout = setTimeout(() => {
    displayText.value = ''
    showSaved.value = false
  }, 2000)
}

const clearTimeouts = () => {
  if (savingInterval) {
    clearInterval(savingInterval)
    savingInterval = null
  }
  if (savedTimeout) {
    clearTimeout(savedTimeout)
    savedTimeout = null
  }
}

watch(isUpdatingAutomation, (newValue, oldValue) => {
  if (newValue && !oldValue) {
    // Started saving
    clearTimeouts()
    showSaved.value = false
    startSavingAnimation()
  } else if (!newValue && oldValue) {
    // Finished saving
    clearTimeouts()
    stopSavingAnimation()
  }
})

onUnmounted(() => {
  clearTimeouts()
})
</script>

<template>
  <div class="h-9 border-t-1 flex items-center border-nc-border-gray-medium px-2 py-1">
    <NcTooltip v-if="isCreateEditScriptAllowed">
      <NcButton
        :class="{
          '!bg-nc-bg-brand': isEditorOpen,
        }"
        size="xsmall"
        type="text"
        @click="isEditorOpen = !isEditorOpen"
      >
        <GeneralIcon
          :class="{
            'text-nc-content-brand': isEditorOpen,
          }"
          icon="sidebar"
        />
      </NcButton>

      <template #title>
        {{ isEditorOpen ? $t('labels.hideEditor') : $t('labels.showEditor') }}
      </template>
    </NcTooltip>

    <Transition name="fade" mode="out-in">
      <div v-if="displayText" class="flex items-center ml-2 gap-2">
        <Transition name="slide-fade" mode="out-in">
          <div
            v-if="isUpdatingAutomation"
            key="saving"
            class="text-nc-content-gray-subtle2 text-bodyDefaultSm flex items-center gap-2"
          >
            <div class="saving-text">{{ displayText }}</div>
          </div>
          <div v-else-if="showSaved" key="saved" class="text-nc-content-green-dark text-bodyDefaultSm flex items-center gap-2">
            <GeneralIcon icon="circleCheck3" class="w-4 h-5 saved-icon" />
            <div class="saved-text">{{ displayText }}</div>
          </div>
        </Transition>
      </div>
    </Transition>

    <div class="flex-1" />

    <div class="flex items-center gap-2">
      <NuxtLink target="_blank" class="nc-docs-link" href="https://nocodb.com/docs/scripts">
        <div class="flex items-center text-nc-content-gray-subtle text-bodySmBold gap-2 px-2">
          <GeneralIcon icon="ncBookOpen" class="w-4 h-4 text-nc-content-gray-subtle" />
          Script Docs
        </div>
      </NuxtLink>
      <NuxtLink target="_blank" class="nc-docs-link" href="https://nocodb.com/docs/scripts/examples/find-and-replace">
        <div class="flex items-center text-nc-content-gray-subtle text-bodySmBold gap-2 px-2">
          <GeneralIcon icon="ncBookOpen" class="w-4 h-4 text-nc-content-gray-subtle" />
          Example Scripts
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped lang="scss">
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.2s ease-in;
}

.slide-fade-enter-from {
  transform: translateX(-10px);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateX(10px);
  opacity: 0;
}

.saving-text {
  transition: opacity 0.2s ease;
}

.saved-text {
  animation: fadeInScale 0.4s ease-out;
}

.saved-icon {
  animation: checkmark 0.5s ease-out;
}

@keyframes fadeInScale {
  0% {
    opacity: 0;
    transform: scale(0.95);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
