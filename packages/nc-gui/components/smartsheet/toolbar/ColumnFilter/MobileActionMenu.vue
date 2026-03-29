<script lang="ts" setup>
interface MenuItem {
  title: string
  onClick: () => void
  danger?: boolean
  icon?: IconMapKey
}

interface Props {
  items: MenuItem[]
}

const props = withDefaults(defineProps<Props>(), {})

const { items } = toRefs(props)

const isOpen = ref(false)
</script>

<template>
  <NcDropdown v-model:visible="isOpen" placement="bottomRight">
    <NcButton type="text" icon-only size="xsmall">
      <template #icon>
        <GeneralIcon icon="threeDotVertical" />
      </template>
    </NcButton>
    <template #overlay>
      <NcMenu variant="small" @click="isOpen = false">
        <template v-for="(item, idx) of items" :key="idx">
          <NcDivider v-if="item.danger" />

          <NcMenuItem :danger="item.danger" @click="item.onClick">
            <GeneralIcon :icon="item.icon" />

            {{ item.title }}
          </NcMenuItem>
        </template>
      </NcMenu>
    </template>
  </NcDropdown>
</template>
