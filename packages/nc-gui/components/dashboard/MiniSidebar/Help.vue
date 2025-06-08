<script lang="ts" setup>
interface ItemType {
  title: string
  icon?: IconMapKey
  e: string
  link: string
  subItems?: ItemType[]
  onClick?: () => void
  copyBtn?: boolean
  tooltip?: string
  hidden?: boolean
}

interface CategoryItemType {
  category: string
  items: ItemType[]
  hidden?: boolean
}

const { $e } = useNuxtApp()

const { t } = useI18n()

const { isMobileMode } = useGlobal()

const { navigateToFeed } = useWorkspace()

const visible = ref(false)

const copyBtnRef = ref()

const helpItems = computed<CategoryItemType[]>(() => {
  return [
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
          e: '',
          link: '',
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
      category: t('general.contactSupport'),
      items: [
        {
          title: 'support@nocodb.com',
          icon: 'ncMail',
          e: 'c:nocodb:contact-us-mail-copy',
          link: '',
          copyBtn: true,
          tooltip: t('labels.clickToCopy'),
        },
      ],
      hidden: !isEeUI,
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
      hidden: !!isMobileMode.value,
    },
  ]
})

const openUrl = (item: ItemType) => {
  if (item.e) {
    $e(item.e, {
      trigger: 'mini-sidebar',
    })
  }

  if (item.onClick) {
    item.onClick()
    visible.value = false
  } else if (item.link.startsWith('http')) {
    window.open(item.link, '_blank')
  } else if (item.link) {
    openLinkUsingATag(item.link, '_blank')
  }

  if (item.copyBtn && copyBtnRef.value) {
    copyBtnRef.value?.[0]?.copyContent?.(item.title)
  }
}
</script>

<template>
  <div class="nc-mini-sidebar-btn-full-width">
    <NcDropdown v-model:visible="visible" :placement="isMobileMode ? 'topRight' : 'right'" overlay-class-name="!min-w-55">
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
            <template v-if="!category.hidden">
              <NcDivider v-if="idx !== 0" />
              <NcMenuItemLabel>
                <span class="normal-case">
                  {{ category.category }}
                </span>
              </NcMenuItemLabel>

              <template v-for="(item, i) of category.items" :key="i">
                <template v-if="!item.hidden">
                  <NcSubMenu v-if="item.subItems" class="py-0" variant="small">
                    <template #title>
                      <GeneralIcon v-if="item.icon" :icon="item.icon" class="h-4 w-4" />
                      {{ item.title }}
                    </template>
                    <template v-for="(subItem, j) of item.subItems" :key="j">
                      <NcMenuItem v-if="!subItem.hidden" @click="openUrl(subItem)">
                        <GeneralIcon v-if="subItem.icon" :icon="subItem.icon" class="h-4 w-4" />
                        {{ subItem.title }}
                      </NcMenuItem>
                    </template>
                  </NcSubMenu>
                  <NcTooltip v-else :title="item.tooltip" :disabled="!item.tooltip" placement="top" hide-on-click>
                    <NcMenuItem @click="openUrl(item)">
                      <GeneralIcon v-if="item.icon" :icon="item.icon" class="h-4 w-4" />
                      {{ item.title }}

                      <GeneralCopyButton
                        v-if="item.copyBtn"
                        ref="copyBtnRef"
                        type="secondary"
                        :content="item.title"
                        :show-toast="false"
                      />
                    </NcMenuItem>
                  </NcTooltip>
                </template>
              </template>
            </template>
          </template>
        </NcMenu>
      </template>
    </NcDropdown>
  </div>
</template>
