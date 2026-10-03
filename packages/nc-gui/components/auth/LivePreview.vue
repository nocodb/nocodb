<script setup lang="ts">
// The auth panel's live product window: four scenes behind the marketing site's pill tabs (landing-page app-window.tsx).
// Scenes always rotate; picking a tab jumps there and restarts the timer.

type Scene = 'grid' | 'interface' | 'dashboard' | 'workflow'

const { isDark } = useTheme()

const { t } = useI18n()

const scenes = computed<{ id: Scene; label: string; icon: keyof typeof iconMap }[]>(() => [
  { id: 'grid', label: t('objects.viewType.grid'), icon: 'grid' },
  { id: 'interface', label: t('general.interfaces'), icon: 'ncLayout' },
  { id: 'dashboard', label: t('objects.dashboards'), icon: 'ncBarChart2' },
  { id: 'workflow', label: t('general.automations'), icon: 'ncAutomation' },
])

const current = ref<Scene>('grid')

let rotation: ReturnType<typeof setInterval> | undefined

function startRotation() {
  clearInterval(rotation)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  rotation = setInterval(() => {
    if (document.hidden) return
    const ids = scenes.value.map((s) => s.id)
    current.value = ids[(ids.indexOf(current.value) + 1) % ids.length]!
  }, 12000)
}

function pick(scene: Scene) {
  current.value = scene
  startRotation()
}

onMounted(() => {
  startRotation()
})

onBeforeUnmount(() => {
  clearInterval(rotation)
})
</script>

<template>
  <div class="relative h-full">
    <div class="px-12">
      <div
        role="tablist"
        :aria-label="t('labels.preview')"
        class="nc-auth-tabs inline-flex items-center gap-0.5 rounded-full p-1 bg-white/12 backdrop-blur-sm"
      >
        <button
          v-for="scene of scenes"
          :key="scene.id"
          type="button"
          role="tab"
          :aria-selected="current === scene.id"
          class="h-8 flex items-center gap-1.5 px-3.5 rounded-full text-bodyDefaultSm transition-colors duration-150"
          :class="current === scene.id ? 'bg-white text-[#16161a]' : 'text-white/85 hover:text-white'"
          @click="pick(scene.id)"
        >
          <GeneralIcon :icon="scene.icon" class="w-4 h-4" :class="{ 'text-nc-content-brand': current === scene.id }" />
          {{ scene.label }}
        </button>
      </div>
    </div>

    <div
      class="nc-auth-window absolute left-12 top-14 bottom-0 w-[1000px] rounded-tl-xl overflow-hidden"
      :class="{ 'nc-auth-window--dark': isDark }"
    >
      <Transition name="nc-auth-scene" mode="out-in">
        <AuthPreviewGrid v-if="current === 'grid'" />
        <AuthPreviewInterface v-else-if="current === 'interface'" />
        <AuthPreviewDashboard v-else-if="current === 'dashboard'" />
        <AuthPreviewWorkflow v-else />
      </Transition>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-auth-tabs {
  box-shadow: inset 0 0 0 1px oklch(1 0 0 / 0.2);
}

.nc-auth-window {
  box-shadow: 0 0 0 1px oklch(0 0 0 / 0.08), 0 2px 4px -1px oklch(0 0 0 / 0.08), 0 24px 48px -16px oklch(0.2 0.15 267 / 0.35);
}

.nc-auth-window--dark {
  box-shadow: 0 0 0 1px oklch(1 0 0 / 0.1), 0 24px 48px -16px oklch(0 0 0 / 0.6);
}

.nc-auth-scene-enter-active,
.nc-auth-scene-leave-active {
  transition: opacity 200ms ease-out;
}

.nc-auth-scene-enter-from,
.nc-auth-scene-leave-to {
  opacity: 0;
}
</style>
