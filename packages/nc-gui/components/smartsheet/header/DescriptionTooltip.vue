<script setup lang="ts">
interface Props {
  description?: string | null
  // 'expanded' — always-visible icon in the expanded record form (clickable header context).
  // 'grid' — hover-revealed icon used in the public grid header and the field-edit menu.
  variant?: 'expanded' | 'grid'
}

const props = withDefaults(defineProps<Props>(), {
  description: '',
  variant: 'expanded',
})

function onIconInteract(e: Event) {
  // In the expanded record form the header row itself is clickable (it opens the field-edit
  // dropdown). Stop the icon's click/dblclick so reading the description never triggers it.
  // Other variants live inside headers without that behaviour.
  if (props.variant === 'expanded') e.stopPropagation()
}
</script>

<template>
  <NcTooltip
    v-if="description?.length"
    overlay-class-name="nc-tooltip-scrollable"
    :class="variant === 'expanded' ? 'flex items-center ml-1' : 'flex'"
    :placement="variant === 'expanded' ? 'bottom' : undefined"
  >
    <template #title>
      <div class="whitespace-pre-wrap break-words">{{ description }}</div>
    </template>
    <GeneralIcon
      icon="info"
      class="nc-column-description-icon flex-none !w-3.5 !h-3.5 !text-nc-content-gray-muted"
      :class="{ 'group-hover:opacity-100': variant === 'grid' }"
      :data-testid="variant === 'expanded' ? 'nc-expanded-field-description' : undefined"
      @click="onIconInteract"
      @dblclick="onIconInteract"
    />
  </NcTooltip>
</template>
