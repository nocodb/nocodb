<script lang="ts" setup>
interface ItemType {
  title: string
  icon?: IconMapKey
  e: string
  link: string
  subItems?: ItemType[]
  onClick?: () => void
}

interface CategoryItemType {
  category: string
  items: ItemType[]
}

const { $e } = useNuxtApp()

const { t } = useI18n()

const { navigateToFeed } = useWorkspace()

const visible = ref(false)

const helpItems: CategoryItemType[] = [
  {
    category: t('general.resources'),
    items: [
      {
        title: t('labels.documentation'),
        icon: 'file',
        e: 'e:nocodb:docs-open',
        link: 'https://docs.nocodb.com/',
      },
      {
        title: t('labels.apis'),
        icon: 'ncCode',
        e: 'c:nocodb:api-open',
        link: 'https://community.nocodb.com/',
        subItems: [
          {
            title: t('labels.dataApiV2'),
            e: 'c:nocodb:data-api-open',
            link: 'https://data-apis-v2.nocodb.com/',
          },
          {
            title: t('labels.metaApiV2'),
            e: 'c:nocodb:meta-api-open',
            link: 'https://meta-apis-v2.nocodb.com/',
          },
        ],
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
        e: 'c:nocodb:twitter',
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
        link: '',
        onClick: () => navigateToFeed(undefined, undefined, { tab: 'github' }),
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
        link: 'mailto:support@nocodb.com',
      },
    ],
  },
]

const openUrl = (item: ItemType) => {
  $e(item.e, {
    trigger: 'mini-sidebar',
  })

  if (item.onClick) {
    item.onClick()
    visible.value = false
  } else if (item.link.startsWith('http')) {
    window.open(item.link, '_blank')
  } else {
    openLinkUsingATag(item.link, '_blank')
  }
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
        <NcMenu variant="small">
          <template v-for="(category, idx) of helpItems" :key="idx">
            <NcDivider v-if="idx !== 0" />
            <NcMenuItemLabel>
              <span class="normal-case">
                {{ category.category }}
              </span>
            </NcMenuItemLabel>

            <template v-for="(item, i) of category.items" :key="i">
              <NcSubMenu v-if="item.subItems" class="py-0" variant="small">
                <template #title>
                  <GeneralIcon v-if="item.icon" :icon="item.icon" class="h-4 w-4" />
                  {{ item.title }}
                </template>
                <NcMenuItem v-for="(subItem, j) of item.subItems" :key="j" @click="openUrl(subItem)">
                  <GeneralIcon v-if="subItem.icon" :icon="subItem.icon" class="h-4 w-4" />
                  {{ subItem.title }}
                </NcMenuItem>
              </NcSubMenu>
              <NcMenuItem v-else @click="openUrl(item)">
                <GeneralIcon v-if="item.icon" :icon="item.icon" class="h-4 w-4" />
                {{ item.title }}
              </NcMenuItem>
            </template>
          </template>
        </NcMenu>
      </template>
    </NcDropdown>
  </div>
</template>

<style lang="scss" scoped></style>
