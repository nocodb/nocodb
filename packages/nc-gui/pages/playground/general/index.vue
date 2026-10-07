<script setup lang="ts">
import PgPage from '../-components/PgPage.vue'
import IconsAndBrand from './-sections/IconsAndBrand.vue'
import Avatars from './-sections/Avatars.vue'
import Pickers from './-sections/Pickers.vue'
import Utilities from './-sections/Utilities.vue'
import Feedback from './-sections/Feedback.vue'
import Overlays from './-sections/Overlays.vue'

const sections = computed(() =>
  [
    { id: 'icons', title: 'Icon' },
    { id: 'brand', title: 'Brand marks' },
    { id: 'source-logos', title: 'Database & integration logos' },
    { id: 'user-icon', title: 'User avatars' },
    { id: 'presence', title: 'Presence stack' },
    { id: 'team', title: 'Teams' },
    { id: 'workspace-icon', title: 'Workspace & base icons' },
    { id: 'table-view-icon', title: 'Table & view icons' },
    { id: 'emoji-picker', title: 'Emoji picker' },
    { id: 'icon-picker', title: 'Icon pickers' },
    { id: 'color-pickers', title: 'Colour pickers' },
    { id: 'copy', title: 'Copy helpers' },
    { id: 'text', title: 'Text & hints' },
    { id: 'language', title: 'Language picker' },
    { id: 'upgrade-badge', title: 'Upgrade badges', ee: true },
    { id: 'misc-buttons', title: 'Misc buttons', ee: true },
    { id: 'loaders', title: 'Loaders' },
    { id: 'progress', title: 'Progress panel' },
    { id: 'locked-view', title: 'Locked view footer' },
    { id: 'alerts', title: 'System banners' },
    { id: 'page-not-found', title: 'Page does not exist' },
    { id: 'modals', title: 'Modals' },
    { id: 'overlay', title: 'Overlay' },
    { id: 'flipping-card', title: 'Flipping card' },
    { id: 'form-banner', title: 'Form banner' },
  ].filter((s) => !s.ee || isEeUI),
)
</script>

<template>
  <PgPage
    title="General components"
    description="Shared app-level pieces from components/general (with EE overrides). Interactive where the component is."
    :sections="sections"
  >
    <IconsAndBrand />
    <Avatars />
    <Pickers />
    <Utilities />
    <Feedback />
    <Overlays />
  </PgPage>
</template>
