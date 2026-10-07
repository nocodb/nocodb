<script setup lang="ts">
import PgPage from '../-components/PgPage.vue'
import PgSection from '../-components/PgSection.vue'
import Palette from './-sections/Palette.vue'
import Semantic from './-sections/Semantic.vue'
import Typography from './-sections/Typography.vue'
import Effects from './-sections/Effects.vue'

const sections = [
  { id: 'palette', title: 'Palette ramps' },
  { id: 'semantic', title: 'Semantic tokens' },
  { id: 'typography', title: 'Typography' },
  { id: 'surfaces', title: 'Surfaces' },
  { id: 'shadows', title: 'Shadows' },
  { id: 'radii', title: 'Radii' },
  { id: 'spacing', title: 'Spacing' },
]
</script>

<template>
  <PgPage
    title="Foundations"
    description="The raw material of the design system. Every value is read from the live CSS, so edits in the token editor show up here immediately. Click any name to copy it."
    :sections="sections"
  >
    <PgSection
      id="palette"
      title="Palette ramps"
      source="assets/css/variables.css"
      description="Reference colours. Dark mode inverts each ramp, so low stops stay the subtle tints in both themes."
    >
      <Palette />
    </PgSection>

    <PgSection
      id="semantic"
      title="Semantic tokens"
      source="--nc-content-* · --nc-bg-* · --nc-border-* · --nc-fill-*"
      description="Prefer these over raw ramp stops. The dark column renders inside a [theme='dark'] wrapper, so it shows exactly what dark mode resolves to."
    >
      <Semantic />
    </PgSection>

    <PgSection
      id="typography"
      title="Typography"
      source="assets/nc-typography-preset.ts"
      description="Figma-aligned text utilities. Each one sets the weight too, so never add font-medium or similar on top."
    >
      <Typography />
    </PgSection>

    <PgSection
      id="surfaces"
      title="Surfaces"
      description="Background layers from app chrome to overlays, and how they stack in a real layout."
    >
      <Effects kind="surfaces" />
    </PgSection>

    <PgSection id="shadows" title="Shadows" source="uno.config.ts → theme.boxShadow">
      <Effects kind="shadows" />
    </PgSection>

    <PgSection id="radii" title="Radii">
      <Effects kind="radii" />
    </PgSection>

    <PgSection id="spacing" title="Spacing" source="--spacing-*">
      <Effects kind="spacing" />
    </PgSection>
  </PgPage>
</template>
