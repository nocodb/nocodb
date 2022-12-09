<script setup lang="ts">
interface Props {
  items: string[]
  command: Function
}

const { items, command } = defineProps<Props>()

const selectedIndex = ref(0)

const selectItem = (index: number) => {
  command(items[index])
}

const upHandler = () => {
  selectedIndex.value = (selectedIndex.value + items.length - 1) % items.length
}

const downHandler = () => {
  selectedIndex.value = (selectedIndex.value + 1) % items.length
}

const enterHandler = () => {
  selectItem(selectedIndex.value)
}

function onKeyDown({ event }: { event: KeyboardEvent }) {
  if (event.key === 'ArrowUp') {
    upHandler()
    return true
  }

  if (event.key === 'ArrowDown') {
    downHandler()
    return true
  }

  if (event.key === 'Enter') {
    enterHandler()
    return true
  }

  return false
}

watch(items, () => {
  selectedIndex.value = 0
})

defineExpose({
  onKeyDown,
})
</script>

<template>
  <div class="items">
    <template v-if="items.length">
      <button
        v-for="(item, index) in items"
        :key="index"
        class="item"
        :class="{ 'is-selected': index === selectedIndex }"
        @click="selectItem(index)"
      >
        {{ item.title }}
      </button>
    </template>
    <div v-else class="item">No result</div>
  </div>
</template>

<style lang="scss">
.items {
  padding: 0.2rem;
  position: relative;
  border-radius: 0.5rem;
  background: #fff;
  color: rgba(0, 0, 0, 0.8);
  overflow: hidden;
  font-size: 0.9rem;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.05), 0px 10px 20px rgba(0, 0, 0, 0.1);
}

.item {
  display: block;
  margin: 0;
  width: 100%;
  text-align: left;
  background: transparent;
  border-radius: 0.4rem;
  border: 1px solid transparent;
  padding: 0.2rem 0.4rem;

  &.is-selected {
    border-color: #000;
  }
}
</style>
