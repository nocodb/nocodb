<script lang="ts" setup>
interface Props {
  team: TeamType
}

const props = withDefaults(defineProps<Props>(), {})

const { team } = toRefs(props)
</script>

<template>
  <div class="nc-modal-teams-edit-content-section">
    <div class="nc-modal-teams-edit-content-section-title text-bodyBold">{{ $t('labels.members') }}</div>
    <div></div>
  </div>
</template>

<style lang="scss" scoped></style>
