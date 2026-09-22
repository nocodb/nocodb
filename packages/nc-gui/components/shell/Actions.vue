<script lang="ts" setup>
// Puts a pane's own action row into the shell's header band — the one action
// zone the shell contract allows — and leaves it where it stands when the pane
// is hosted anywhere else (the admin panel, a standalone modal).
//
// The pane keeps owning the markup, so its permission gates, upgrade badges and
// disabled-reason tooltips travel with it; the shell only decides where it lands.
const shell = useShell()

// Injected, so this resolves to the shell the pane is actually inside — not
// whichever one mounted last.
const target = computed(() => (shell ? `#${shell.actionsTargetId}` : null))

const canTeleport = ref(false)

onMounted(async () => {
  // The band renders before the pane in the shell's own tree, but wait a tick
  // anyway so a pane that mounts during the modal's first paint still finds it.
  await nextTick()

  canTeleport.value = !!target.value && !!document.querySelector(target.value)
})
</script>

<template>
  <Teleport v-if="canTeleport && target" :to="target">
    <slot />
  </Teleport>
  <slot v-else />
</template>
