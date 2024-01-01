<script lang="ts" setup>
import { iconMap } from '#imports'
import type { UsersSortType } from '~/lib'

const { field, direction, handleUserSort } = defineProps<{
  field: UsersSortType['field']
  direction: UsersSortType['direction']
  handleUserSort: Function
}>()

const isOpen = ref(false)

const sortUserBy = (direction?: UsersSortType['direction']) => {
  handleUserSort({
    field,
    direction,
  })
  isOpen.value = false
}
</script>

<template>
  <a-dropdown
    v-model:visible="isOpen"
    :trigger="['click']"
    placement="bottomLeft"
    overlay-class-name="nc-user-menu-column-operations !border-1 rounded-lg !shadow-xl"
    @click.stop="isOpen = !isOpen"
  >
    <div>
      <GeneralIcon
        :icon="direction === 'asc' || direction === 'desc' ? 'sortDesc' : 'arrowDown'"
        class="text-grey h-full text-grey nc-user-menu-trigger cursor-pointer outline-0 mr-2 transition-none"
        :style="{ transform: direction === 'asc' ? 'rotate(180deg)' : undefined }"
      />
    </div>
    <template #overlay>
      <NcMenu class="flex flex-col gap-1 border-gray-200 nc-user-menu-column-options">
        <NcMenuItem @click="sortUserBy('asc')">
          <div class="nc-column-insert-after nc-user-menu-item">
            <component
              :is="iconMap.sortDesc"
              class="text-gray-700 !rotate-180 !w-4.25 !h-4.25"
              :style="{
                transform: 'rotate(180deg)',
              }"
            />

            <!-- Sort Ascending -->
            {{ $t('general.sortAsc') }}
          </div>
        </NcMenuItem>
        <NcMenuItem @click="sortUserBy('desc')">
          <div class="nc-column-insert-before nc-user-menu-item">
            <component :is="iconMap.sortDesc" class="text-gray-700 !w-4.25 !h-4.25 ml-0.5 mr-0.25" />
            <!-- Sort Descending -->
            {{ $t('general.sortDesc') }}
          </div>
        </NcMenuItem>
      </NcMenu>
    </template>
  </a-dropdown>
</template>

<style scoped>
.nc-user-menu-item {
  @apply flex items-center gap-2;
}

.nc-user-menu-column-options {
  .nc-icons {
    @apply !w-5 !h-5;
  }
}

:deep(.ant-dropdown-menu-item) {
  @apply !hover:text-black text-gray-700;
}
</style>
