<script setup lang="ts">
const props = defineProps<{
  activeCategory: string
}>()

const activeCategory = useVModel(props, 'activeCategory')

const { query } = useTemplates()

const isSearchFocused = ref(false)

const setActiveItem = (category: string) => {
  activeCategory.value = category
}
</script>

<template>
  <div class="flex flex-col gap-6 w-[242px]">
    <h1 class="text-nc-content-gray-subtle2 font-bold leading-6">Categories</h1>
    <Transition name="search-slide" appear>
      <div class="relative">
        <a-input
          v-model:value="query.search"
          type="text"
          placeholder="Search for keywords like CRM..."
          class="nc-input-sm nc-input-shadow transition-all duration-300"
          @focus="isSearchFocused = true"
          @blur="isSearchFocused = false"
        >
          <template #prefix>
            <Transition name="search-icon" mode="out-in">
              <GeneralIcon
                :key="query.search?.length ? 'active' : 'inactive'"
                :class="{
                  'text-nc-content-brand': query.search?.length || isSearchFocused,
                  'text-nc-content-gray-muted': !query.search?.length && !isSearchFocused,
                }"
                icon="search"
              />
            </Transition>
          </template>
        </a-input>
      </div>
    </Transition>

    <TransitionGroup name="stagger-items" tag="div" class="flex flex-col gap-6">
      <MarketplaceSidebarItem key="marketplace" :active="activeCategory === 'marketplace'" @click="setActiveItem('marketplace')">
        Marketplace
      </MarketplaceSidebarItem>
      <MarketplaceSidebarFolder key="departments">
        <template #title> Departments </template>

        <MarketplaceSidebarItem :active="activeCategory === 'sales'" @click="setActiveItem('sales')">
          <template #icon>
            <img src="~assets/img/marketplace/sales.png" alt="" class="w-5 h-5" />
          </template>
          Sales
        </MarketplaceSidebarItem>

        <MarketplaceSidebarItem :active="activeCategory === 'marketing'" @click="setActiveItem('marketing')">
          <template #icon>
            <img src="~assets/img/marketplace/marketing.png" alt="" class="w-5 h-5" />
          </template>
          Marketing
        </MarketplaceSidebarItem>
        <MarketplaceSidebarItem :active="activeCategory === 'hr'" @click="setActiveItem('hr')">
          <template #icon>
            <img src="~assets/img/marketplace/human-resources.png" alt="" class="w-5 h-5" />
          </template>
          Human Resources
        </MarketplaceSidebarItem>
        <MarketplaceSidebarItem :active="activeCategory === 'product-management'" @click="setActiveItem('product-management')">
          <template #icon>
            <img src="~assets/img/marketplace/product-management.png" alt="" class="w-5 h-5" />
          </template>
          Product Management
        </MarketplaceSidebarItem>

        <MarketplaceSidebarItem :active="activeCategory === 'operations'" @click="setActiveItem('operations')">
          <template #icon>
            <img src="~assets/img/marketplace/operations.png" alt="" class="w-5 h-5" />
          </template>
          Operations
        </MarketplaceSidebarItem>
        <MarketplaceSidebarItem :active="activeCategory === 'project-management'" @click="setActiveItem('project-management')">
          <template #icon>
            <img src="~assets/img/marketplace/product-management.png" alt="" class="w-5 h-5" />
          </template>
          Project Management
        </MarketplaceSidebarItem>
      </MarketplaceSidebarFolder>

      <MarketplaceSidebarFolder key="industries">
        <template #title> Industries </template>

        <MarketplaceSidebarItem :active="activeCategory === 'healthcare'" @click="setActiveItem('healthcare')">
          <template #icon>
            <img src="~assets/img/marketplace/healthcare.png" alt="" class="w-5 h-5" />
          </template>
          Healthcare
        </MarketplaceSidebarItem>
        <MarketplaceSidebarItem :active="activeCategory === 'finance'" @click="setActiveItem('finance')">
          <template #icon>
            <img src="~assets/img/marketplace/finance.png" alt="" class="w-5 h-5" />
          </template>
          Finance
        </MarketplaceSidebarItem>
        <MarketplaceSidebarItem :active="activeCategory === 'education'" @click="setActiveItem('education')">
          <template #icon>
            <img src="~assets/img/marketplace/education.png" alt="" class="w-5 h-5" />
          </template>
          Education
        </MarketplaceSidebarItem>

        <MarketplaceSidebarItem :active="activeCategory === 'manufacturing'" @click="setActiveItem('manufacturing')">
          <template #icon>
            <img src="~assets/img/marketplace/manufacturing.png" alt="" class="w-5 h-5" />
          </template>
          Manufacturing
        </MarketplaceSidebarItem>
        <MarketplaceSidebarItem :active="activeCategory === 'real-estate'" @click="setActiveItem('real-estate')">
          <template #icon>
            <img src="~assets/img/marketplace/realestate.png" alt="" class="w-5 h-5" />
          </template>
          Real Estate
        </MarketplaceSidebarItem>
        <MarketplaceSidebarItem :active="activeCategory === 'retail'" @click="setActiveItem('retail')">
          <template #icon>
            <img src="~assets/img/marketplace/retail.png" alt="" class="w-5 h-5" />
          </template>
          Retail
        </MarketplaceSidebarItem>
      </MarketplaceSidebarFolder>
    </TransitionGroup>
  </div>
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
