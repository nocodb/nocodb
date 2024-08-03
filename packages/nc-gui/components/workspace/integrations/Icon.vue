<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    integrationType: string
    size?: 'xs' | 'sm' | 'md' | 'lg'
  }>(),
  {
    size: 'md',
  },
)

const { integrationType: integrationTypeOrigin } = useIntegrationStore()

const { size, integrationType } = toRefs(props)

const pxSize = computed(() => {
  switch (size.value) {
    case 'xs':
      return '16px'
    case 'sm':
      return '24px'
    case 'md':
      return '32px'
    case 'lg':
      return '48px'
  }
})
</script>

<template>
  <div class="logo-wrapper">
    <GeneralBaseLogo
      v-if="integrationType === integrationTypeOrigin.MySQL"
      source-type="mysql2"
      :style="{ width: pxSize, height: pxSize }"
    />
    <GeneralBaseLogo
      v-else-if="integrationType === integrationTypeOrigin.PostgreSQL"
      source-type="pg"
      :style="{ width: pxSize, height: pxSize }"
    />
    <GeneralIcon v-else-if="integrationType === 'request'" icon="plusSquare" :style="{ width: pxSize, height: pxSize }" />
  </div>
</template>

<style lang="scss" scoped>
.logo-wrapper {
  @apply bg-gray-200 p-2 rounded-lg flex items-center justify-center;
}
</style>
