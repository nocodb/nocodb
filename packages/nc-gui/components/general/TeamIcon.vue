<script lang="ts" setup>
import { IconType } from 'nocodb-sdk'

const props = withDefaults(
  defineProps<{
    icon?: string
    iconType?: IconType | string
    size?: 'small' | 'medium' | 'base' | 'large' | 'xlarge' | 'auto'
    placeholderIcon?: IconMapKey
  }>(),
  {
    size: 'medium',
    placeholderIcon: 'ncUsers',
  },
)

const { icon, iconType, size, placeholderIcon, ...restProps } = toRefs(props)
</script>

<template>
  <GeneralUserIcon
    v-bind="restProps"
    :user="{
      meta: {
        icon: icon,
        iconType: iconType,
      },
    }"
    :placeholder-icon="placeholderIcon"
    :size="size"
  />
</template>
