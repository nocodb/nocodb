<script lang="ts" setup>
import { Pane, Splitpanes } from 'splitpanes'
import 'splitpanes/dist/splitpanes.css'

const { isOpen } = storeToRefs(useSidebarStore())
const wrapperRef = ref<HTMLDivElement>()
const sideBarSize = ref({
  old: 25,
  current: 25,
})
const contentSize = ref({
  old: 75,
  current: 75,
})
const isSidebarShort = ref(false)
const animationDuration = 300
const viewportWidth = ref(window.innerWidth)
const isMouseOverShowSidebarZone = ref(false)

const sidebarWidth = computed(() => (sideBarSize.value.old * viewportWidth.value) / 100)
const currentSidebarSize = computed({
  get: () => sideBarSize.value.current,
  set: (val) => {
    sideBarSize.value.current = val
  },
})

const isSidebarHidden = ref(false)

watch(isOpen, () => {
  sideBarSize.value.current = sideBarSize.value.old

  if (isOpen.value) {
    contentSize.value.current = contentSize.value.old

    setTimeout(() => {
      isSidebarShort.value = true

      isSidebarHidden.value = false
    }, 0)

    setTimeout(() => {
      isSidebarShort.value = false
    }, animationDuration / 2)
  } else {
    sideBarSize.value.old = sideBarSize.value.current

    contentSize.value.current = contentSize.value.old
    contentSize.value.current = 100

    isSidebarShort.value = true

    setTimeout(() => {
      isSidebarHidden.value = true
      sideBarSize.value.current = 0
    }, animationDuration)
  }
})

document.addEventListener('mousemove', (e) => {
  if (!wrapperRef.value) return
  if (isOpen.value && !isSidebarHidden.value && !isMouseOverShowSidebarZone.value) return
  if (isOpen.value) {
    isSidebarHidden.value = false
    isMouseOverShowSidebarZone.value = false
    return
  }

  if (e.clientX < sidebarWidth.value) {
    isSidebarHidden.value = false
    isMouseOverShowSidebarZone.value = true
  } else {
    isSidebarHidden.value = true
    isMouseOverShowSidebarZone.value = false
  }
})

watch(
  () => window.innerWidth,
  () => {
    viewportWidth.value = window.innerWidth
  },
)
</script>

<script lang="ts">
export default {
  name: 'DashboardLayout',
}
</script>

<template>
  <NuxtLayout>
    <Splitpanes
      style="height: 100vh"
      :class="{
        'sidebar-short': isSidebarShort,
      }"
    >
      <Pane min-size="15%" :size="currentSidebarSize" max-size="40%" class="relative !overflow-visible">
        <div
          ref="wrapperRef"
          class="nc-sidebar-wrapper relative z-10"
          :class="{
            'open': isOpen,
            'close': !isOpen,
            'absolute': isMouseOverShowSidebarZone,
            'sidebar-short': isSidebarShort,
            'hide-sidebar': isSidebarHidden,
          }"
          :style="{
            width: isMouseOverShowSidebarZone ? `${sidebarWidth}px` : '100%',
            overflow: isMouseOverShowSidebarZone ? 'visible' : undefined,
          }"
        >
          <DashboardSidebar
            :style="{
              transition: 'all 0.3s ease-in-out',
            }"
          />
        </div>
      </Pane>
      <div v-if="!isOpen" class="relative pl-2 flex flex-col h-full z-40">
        <div class="mt-2 p-1 px-1.5 rounded-md hover:bg-gray-100 cursor-pointer" @click="isOpen = true">
          <MdiMenu v-if="isSidebarHidden" />
          <IcBaselineKeyboardDoubleArrowRight v-else />
        </div>
      </div>
      <Pane :size="contentSize.current">
        <slot name="content" />
      </Pane>
    </Splitpanes>
  </NuxtLayout>
</template>

<style lang="scss">
.splitpanes__splitter {
  @apply w-0.25 mr-0.75 h-full bg-gray-200 hover:w-1 hover:mr-0;
  &:hover {
    cursor: ew-resize;
  }
}

.sidebar-short {
  .splitpanes__splitter {
    display: none !important;
    background-color: transparent !important;
  }
}
.splitpanes--dragging .splitpanes__splitter {
  @apply w-1 mr-0;
}

.splitpanes--dragging {
  cursor: ew-resize;
}

.nc-sidebar-wrapper {
  @apply flex flex-col h-full justify-center;
}

.nc-sidebar-wrapper.close {
  .nc-sidebar {
    height: 80vh;
  }
}

.nc-sidebar-wrapper.sidebar-short {
  .nc-sidebar {
    height: 80vh !important;
  }
}

.nc-sidebar-wrapper.open {
  height: 100vh;
  .nc-sidebar {
    height: 100vh;
  }
}

.nc-sidebar {
  height: calc(100% - var(--header-height));
}

.nc-sidebar-wrapper.hide-sidebar .nc-sidebar {
  position: absolute;
  transform: translateX(-100%);
  opacity: 0;
}
.nc-sidebar-wrapper.sidebar-short .nc-sidebar {
  @apply !(rounded-lg border-1 border-gray-100 shadow-lg);
}
</style>
