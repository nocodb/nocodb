<script setup lang="ts">
import PgPage from '../-components/PgPage.vue'
import Badges from './-sections/Badges.vue'
import Buttons from './-sections/Buttons.vue'
import DateTime from './-sections/DateTime.vue'
import Feedback from './-sections/Feedback.vue'
import Inputs from './-sections/Inputs.vue'
import Lists from './-sections/Lists.vue'
import Menus from './-sections/Menus.vue'
import Misc from './-sections/Misc.vue'
import ModalPatterns from './-sections/ModalPatterns.vue'
import Navigation from './-sections/Navigation.vue'
import Overlays from './-sections/Overlays.vue'
import Selects from './-sections/Selects.vue'
import Toggles from './-sections/Toggles.vue'

const SECTIONS = [
  { id: 'buttons', title: 'Buttons' },
  { id: 'badges', title: 'Badges & tags' },
  { id: 'toggles', title: 'Switches, checkboxes & radios' },
  { id: 'inputs', title: 'Text inputs' },
  { id: 'selects', title: 'Selects' },
  { id: 'menus', title: 'Dropdowns & menus' },
  { id: 'modal-patterns', title: 'Modal patterns' },
  { id: 'overlays', title: 'Modals, drawers & popovers' },
  { id: 'feedback', title: 'Alerts, toasts & tooltips' },
  { id: 'navigation', title: 'Navigation' },
  { id: 'datetime', title: 'Date & time pickers' },
  { id: 'lists', title: 'Lists & tables' },
  { id: 'misc', title: 'Data display & utilities' },
]
</script>

<template>
  <PgPage
    title="Nc components"
    description="The design-system primitives in components/nc, rendered with every meaningful variant and state. Open Tokens to see how colour, font and radius changes ripple through them."
    :sections="SECTIONS"
  >
    <Buttons />
    <Badges />
    <Toggles />
    <Inputs />
    <Selects />
    <Menus />
    <ModalPatterns />
    <Overlays />
    <Feedback />
    <Navigation />
    <DateTime />
    <Lists />
    <Misc />
  </PgPage>
</template>
