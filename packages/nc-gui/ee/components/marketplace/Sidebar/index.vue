<script setup lang="ts">
const props = defineProps<{
  activeCategory: TemplateCategoryType | string
}>()

const activeCategory = useVModel(props, 'activeCategory')

const { query, categoryInfo, onInit, loadTemplates } = useMarketplaceTemplates()

const route = useRoute()
const router = useRouter()

const { t } = useI18n()

const isSearchFocused = ref(false)

const setActiveItem = (category: TemplateCategoryType) => {
  activeCategory.value = category

  const typeOrId = route.params.typeOrId

  if (category === 'all-templates') {
    router.push(`/${typeOrId}/templates`)
  } else {
    router.push(`/${typeOrId}/templates/${category}`)
  }
}

interface SidebarItem extends TemplateCategoryInfoItemType {
  key: TemplateCategoryType | string
  isFolder?: boolean
  childrens?: SidebarItem[]
}

const sidebarItems = computed(() => {
  return [
    { key: 'all-templates', ...categoryInfo['all-templates'], onClick: () => setActiveItem('all-templates') },
    {
      key: 'departments',
      title: t('objects.templates.departments'),
      isFolder: true,
      childrens: [
        ...Object.entries(categoryInfo)
          .filter(([_key, category]) => category.group === TemplateCategoryGroup.Departments)
          .map(([key, category]) => ({
            key,
            ...category,
          }))
          .sort((a, b) => a.order - b.order),
      ],
    },
    {
      key: 'industries',
      title: t('objects.templates.industries'),
      isFolder: true,
      childrens: [
        ...Object.entries(categoryInfo)
          .filter(([_key, category]) => category.group === TemplateCategoryGroup.Industries)
          .map(([key, category]) => ({
            key,
            ...category,
          }))
          .sort((a, b) => a.order - b.order),
      ],
    },
  ] as SidebarItem[]
})

onMounted(() => {
  query.search = ''
  activeCategory.value = (route.params.category as TemplateCategoryType) || 'all-templates'
  onInit()
})

const onSearchChange = useDebounceFn(() => {
  loadTemplates(true)
}, 500)
</script>

<template>
  <aside class="nc-marketplace-sidebar">
    <div class="sticky top-0 flex flex-col gap-4 w-[266px] h-[calc(100dvh_-_48px)]">
      <Transition name="search-slide" appear>
        <div class="relative px-3 pt-6">
          <a-input
            v-model:value="query.search"
            type="text"
            allow-clear
            :placeholder="$t('placeholder.searchTemplates')"
            class="nc-input-sm nc-input-shadow transition-all duration-300"
            @input="onSearchChange"
            @focus="isSearchFocused = true"
            @blur="isSearchFocused = false"
          >
            <template #prefix>
              <Transition name="search-icon" mode="out-in">
                <GeneralIcon
                  :key="query.search?.length ? 'active' : 'inactive'"
                  class="nc-search-icon"
                  :class="{
                    'text-nc-content-brand': query.search?.length || isSearchFocused,
                    'text-nc-content-gray-disabled': !query.search?.length && !isSearchFocused,
                  }"
                  icon="search"
                />
              </Transition>
            </template>
          </a-input>
        </div>
      </Transition>

      <TransitionGroup name="stagger-items" tag="div" class="flex-1 flex flex-col gap-4 nc-scrollbar-thin px-3 relative pb-3">
        <template v-for="item of sidebarItems" :key="item.key">
          <MarketplaceSidebarItem
            v-if="!item.isFolder"
            :active="activeCategory === item.key"
            class="my-[1px]"
            @click="setActiveItem(item.key)"
          >
            <template v-if="item.sidebarImg || item.icon" #icon>
              <img v-if="item.sidebarImg" :src="item.sidebarImg" :alt="item.sidebarTitle" class="w-5 h-5 object-contain" />
              <div v-else class="flex items-center justify-center w-5 h-5">
                <GeneralIcon :icon="item.icon" class="w-4 h-4 flex-none opacity-90" />
              </div>
            </template>
            {{ item.sidebarTitle }}
          </MarketplaceSidebarItem>
          <MarketplaceSidebarFolder v-else :key="item.key" class="my-[1px]">
            <template #title> {{ item.title }} </template>

            <template v-for="child of item.childrens" :key="child.key">
              <MarketplaceSidebarItem :active="activeCategory === child.key" class="my-[1px]" @click="setActiveItem(child.key)">
                <template v-if="child.sidebarImg" #icon>
                  <img :src="child.sidebarImg" alt="" class="w-5 h-5" />
                </template>
                {{ child.sidebarTitle }}
              </MarketplaceSidebarItem>
            </template>
          </MarketplaceSidebarFolder>
        </template>
      </TransitionGroup>
    </div>
  </aside>
</template>

<style scoped lang="scss">
.stagger-items-enter-active {
  transition: all 0.5s ease-out;
}

.stagger-items-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.stagger-items-move {
  transition: transform 0.3s ease-out;
}

.folder-items-enter-active {
  transition: all 0.4s ease-out;
}

.folder-items-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.folder-items-move {
  transition: transform 0.3s ease-out;
}
</style>
