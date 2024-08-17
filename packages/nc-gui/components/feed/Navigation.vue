<script setup lang="ts">
const props = defineProps<{
  activeKey: string
}>()

const emits = defineEmits(['update:activeKey'])

const activeKey = useVModel(props, 'activeKey', emits)

const navigationElements = [
  {
    key: 'recents',
    icon: iconMap.clock,
    title: 'Recents',
    description: 'Recent activities',
  },
  {
    key: 'changelog',
    icon: iconMap.list,
    title: 'Changelog',
    description: 'Recent changes',
  },
  {
    key: 'roadmap',
    icon: iconMap.ncNavigation,
    title: 'Roadmap',
    description: 'Upcoming features',
  },
]
</script>

<template>
  <div style="height: calc(100% - var(--topbar-height))" class="w-80 p-3 flex flex-col justify-between">
    <div class="flex flex-col gap-1">
      <div
        v-for="elem in navigationElements"
        :key="elem.title"
        :class="{
          'bg-[#F0F3FF]': activeKey === elem.key,
          'hover:bg-gray-100': activeKey !== elem.key,
        }"
        class="flex items-center rounded-lg cursor-pointer transition-all gap-2 p-2"
        @click="activeKey = elem.key"
      >
        <div
          :class="{
            '!bg-transparent': activeKey === elem.key,
          }"
          class="bg-gray-200 rounded-md h-6 flex items-center justify-center w-6"
        >
          <component
            :is="elem.icon"
            :class="{
              'text-[#2952CC]': activeKey === elem.key,
            }"
            class="text-gray-700 w-4 h-4"
          />
        </div>
        <div class="flex gap-1 flex-col">
          <div
            :class="{
              'text-[#2952CC]': activeKey === elem.key,
              'text-gray-800': activeKey !== elem.key,
            }"
            class="font-semibold"
          >
            {{ elem.title }}
          </div>

          <div class="text-xs text-gray-500">
            {{ elem.description }}
          </div>
        </div>
      </div>
    </div>
    <NcMenu>
      <a
        v-e="['c:nocodb:twitter']"
        href="https://twitter.com/nocodb"
        target="_blank"
        class="!underline-transparent"
        rel="noopener noreferrer"
      >
        <NcMenuItem class="social-icon-wrapper group">
          <GeneralIcon class="social-icon" icon="ncTwitter" />
          <span class="menu-btn"> @nocodb </span>
        </NcMenuItem>
      </a>
      <a
        v-e="['c:nocodb:discord']"
        href="https://discord.gg/5RgZmkW"
        target="_blank"
        class="!underline-transparent"
        rel="noopener noreferrer"
      >
        <NcMenuItem class="social-icon-wrapper">
          <GeneralIcon class="social-icon" icon="ncDiscord" />
          <span class="menu-btn"> {{ $t('labels.community.joinDiscord') }} </span>
        </NcMenuItem>
      </a>
      <a
        v-e="['c:nocodb:reddit']"
        href="https://www.reddit.com/r/NocoDB"
        target="_blank"
        class="!underline-transparent"
        rel="noopener noreferrer"
      >
        <NcMenuItem class="social-icon-wrapper">
          <GeneralIcon class="social-icon" icon="ncReddit" />
          <span class="menu-btn"> {{ $t('labels.community.joinReddit') }} </span>
        </NcMenuItem>
      </a>
    </NcMenu>
  </div>
</template>

<style scoped lang="scss">
menu-btn {
  line-height: 1.5;
}
.menu-icon {
  @apply w-4 h-4;
  font-size: 1rem;
}

:deep(.ant-popover-inner-content) {
  @apply !p-0 !rounded-md;
}

.social-icon {
  @apply my-0.5 w-4 h-4 stroke-transparent;
}

.social-icon-wrapper {
  @apply !w-5 !h-5 !text-gray-800;
  .nc-icon {
    @apply mr-0.15;
  }
}
</style>
