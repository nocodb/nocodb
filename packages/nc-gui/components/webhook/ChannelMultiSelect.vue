<script setup lang="ts">
interface Props {
  modelValue: Record<string, any>[]
  availableChannelList: Record<string, any>[]
  placeholder: string
}

const { availableChannelList, placeholder, ...rest } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const vModel = useVModel(rest, 'modelValue', emit)

// idx of selected channels
const localChannelValues = ref<number[]>([])

// availableChannelList with idx enriched
const availableChannelWithIdxList = ref<Record<string, any>[]>([])

function setAvailableChannelWithIdxList(availableChannelList: Record<string, any>[]) {
  if (availableChannelList.length) {
    // enrich idx
    let idx = 0
    availableChannelWithIdxList.value = availableChannelList.map((channel) => ({
      ...channel,
      idx: idx++,
    }))

    // build localChannelValues from modelValue
    for (const channel of rest.modelValue || []) {
      const target = availableChannelWithIdxList.value.find(
        (availableChannelWithIdx) =>
          availableChannelWithIdx.webhook_url === channel.webhook_url && availableChannelWithIdx.channel === channel.channel,
      )
      if (target) {
        localChannelValues.value.push(target.idx)
      }
    }
  }
}

watch(
  () => availableChannelList,
  (n, o) => {
    if (n !== o) {
      setAvailableChannelWithIdxList(n)
    }
  },
)

watch(
  () => localChannelValues.value,
  (v) => {
    const res = []
    for (const channelIdx of v) {
      const target = availableChannelWithIdxList.value.find((availableChannel) => availableChannel.idx === channelIdx)
      if (target) {
        // push without target.idx
        res.push({ webhook_url: target.webhook_url, channel: target.channel })
      }
    }
    vModel.value = res
  },
)

onBeforeMount(() => setAvailableChannelWithIdxList(availableChannelList))
</script>

<template>
  <a-select
    v-model:value="localChannelValues"
    mode="multiple"
    :placeholder="placeholder"
    max-tag-count="responsive"
    dropdown-class-name="nc-dropdown-webhook-channel"
  >
    <a-select-option v-for="channel of availableChannelWithIdxList" :key="channel.idx" :value="channel.idx">
      {{ channel.channel }}
    </a-select-option>
  </a-select>
</template>
