<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  isOpen: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isOpen: false,
})

const emits = defineEmits(['update:isOpen'])

const isOpen = useVModel(props, 'isOpen', emits)

const ncLinksDropdownRef = ref<HTMLDivElement>()

const randomClass = `link-records_${Math.floor(Math.random() * 99999)}`

const addOrRemoveClass = (add: boolean = false) => {
  const dropdownRoot = ncLinksDropdownRef.value?.parentElement?.parentElement?.parentElement?.parentElement as HTMLElement
  if (dropdownRoot) {
    if (add) {
      dropdownRoot.classList.add('inset-0', 'nc-link-dropdown-root', `nc-root-${randomClass}`)
    } else {
      dropdownRoot.classList.remove('inset-0', 'nc-link-dropdown-root', `nc-root-${randomClass}`)
    }
  }
}

watch(
  isOpen,
  (next) => {
    if (next) {
      onClickOutside(document.querySelector(`.${randomClass}`)! as HTMLDivElement, (e) => {
        const targetEl = e?.target as HTMLElement
        if (!targetEl?.classList.contains(`nc-root-${randomClass}`) || targetEl?.closest(`.nc-${randomClass}`)) {
          return
        }
        isOpen.value = false

        addOrRemoveClass(false)
      })
    } else {
      addOrRemoveClass(false)
    }
  },
  { flush: 'post' },
)

watch([ncLinksDropdownRef, isOpen], () => {
  if (!ncLinksDropdownRef.value) return

  if (isOpen.value) {
    addOrRemoveClass(true)
  } else {
    addOrRemoveClass(false)
  }
})
</script>

<template>
  <NcDropdown
    :visible="isOpen"
    placement="bottom"
    overlay-class-name="nc-links-dropdown !min-w-[540px]"
    :class="`.nc-${randomClass}`"
  >
    <slot />
    <template #overlay>
      <div ref="ncLinksDropdownRef" class="h-[412px] w-[540px] nc-links-dropdown-wrapper" :class="`${randomClass}`">
        <slot name="overlay" />
      </div>
    </template>
  </NcDropdown>
</template>

<style lang="scss">
.nc-links-dropdown {
  @apply rounded-xl !border-gray-200;
  z-index: 1000 !important;
}
.nc-link-dropdown-root {
  z-index: 1000;
}

.nc-links-dropdown-wrapper {
  @apply h-[412px] w-[540px];
  overflow-y: auto;
  overflow-x: hidden;
  resize: vertical;
  min-height: 412px;
  max-height: 700px;
  max-width: 540px;
}
</style>
