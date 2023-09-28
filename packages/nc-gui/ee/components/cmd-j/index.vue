<script setup lang="ts">
const props = defineProps<{
  open: boolean
}>()
const emits = defineEmits(['update:open'])

const keys = useMagicKeys()

const modalEl = ref<HTMLElement | null>(null)

const vOpen = useVModel(props, 'open', emits)

const hide = () => {
  document.getElementById('searchbar')?.classList.replace('block', 'hidden')
  vOpen.value = false
}
const show = () => {
  document.getElementById('searchbar')?.classList.replace('hidden', 'block')
  document.getElementsByClassName('DocSearch DocSearch-Button')[0].click()
  vOpen.value = true
}

whenever(keys.ctrl_j, () => {
  show()
})

whenever(keys.meta_j, () => {
  show()
})

whenever(keys.ctrl_k, () => {
  hide()
})

whenever(keys.meta_k, () => {
  hide()
})

whenever(keys.ctrl_l, () => {
  hide()
})

whenever(keys.meta_l, () => {
  hide()
})

whenever(keys.Escape, () => {
  hide()
})

onClickOutside(modalEl, () => {
  hide()
})

onMounted(() => {
  docsearch({
    container: '#searchbar',
    typesenseCollectionName: 'nocodb-oss-docs-index',
    typesenseServerConfig: {
      nodes: [
        {
          host: 'rqf5uvajyeczwt3xp-1.a1.typesense.net',
          port: 443,
          protocol: 'https',
        },
      ],
      apiKey: 'lNKDTZdJrE76Sg8WEyeN9mXT29l1xq7Q',
    },
    typesenseSearchParameters: {
      // Optional.
    },
  })
})
</script>

<template>
  <div id="searchbar" :ref="modalEl" class="hidden opacity-0 h-[2px]"></div>
</template>

<style></style>
