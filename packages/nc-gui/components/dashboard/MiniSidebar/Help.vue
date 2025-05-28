<script lang="ts" setup>
interface ItemType {
  title: string
  icon: IconMapKey
  e: string
  link: string
}

interface CategoryItemType {
  category: string
  items: ItemType[]
}

const { $e } = useNuxtApp()

const { t } = useI18n()

const visible = ref(false)

const helpItems: CategoryItemType[] = [
  {
    category: t('general.resources'),
    items: [
      {
        title: t('labels.documentation'),
        icon: 'file',
        e: 'e:nocodb:docs-open',
        link: '',
      },
      {
        title: t('labels.apis'),
        icon: 'ncCode',
        e: 'c:nocodb:api-open',
        link: 'https://community.nocodb.com/',
      },
    ],
  },
  {
    category: t('general.community'),
    items: [
      {
        title: t('title.forum'),
        icon: 'ncDiscordForum',
        e: 'c:nocodb:forum-open',
        link: 'https://community.nocodb.com/',
      },
      {
        title: t('general.youtube'),
        icon: 'ncYoutube',
        e: 'c:nocodb:youtube-open',
        link: 'https://www.youtube.com/@nocodb',
      },
      {
        title: 'X',
        icon: 'ncLogoTwitter',
        link: 'https://twitter.com/nocodb',
        e: 'c:nocodb:twitter-open',
      },
    ],
  },
  {
    category: t('title.whatsNew'),
    items: [
      {
        title: t('general.changelog'),
        icon: 'ncList',
        e: 'c:nocodb:changelog-open',
        link: 'https://community.nocodb.com/',
      },
    ],
  },
  {
    category: t('general.support'),
    items: [
      {
        title: t('general.contactUs'),
        icon: 'ncHeadphone',
        e: 'c:nocodb:contact-us-open',
        link: 'https://community.nocodb.com/',
      },
    ],
  },
]

const openUrl = (url: string, e: string) => {
  $e(e, {
    trigger: 'feed',
  })
  window.open(url, '_blank')
}
</script>

<template>
  <div class="nc-mini-sidebar-btn-full-width">
    <NcDropdown v-model:visible="visible" :overlay-class-name="`!min-w-55 !left-1`">
      <div class="w-full py-1 flex items-center justify-center">
        <div
          class="nc-mini-sidebar-btn"
          :class="{
            hovered: visible,
          }"
        >
          <GeneralIcon icon="ncHelp" />
        </div>
      </div>

      <template #overlay>
        <NcMenu variant="small" @click="visible = false">
          <template v-for="(category, idx) of helpItems" :key="idx">
            <NcDivider v-if="idx !== 0" />
            <NcMenuItemLabel>
              <span class="normal-case">
                {{ category.category }}
              </span>
            </NcMenuItemLabel>

            <NcMenuItem v-for="(item, i) of category.items" :key="i" @click="openUrl(item.link, item.e)">
              <GeneralIcon :icon="item.icon" class="h-4 w-4" />
              {{ item.title }}
            </NcMenuItem>
          </template>
        </NcMenu>
      </template>
    </NcDropdown>
  </div>
</template>

<style lang="scss" scoped></style>
