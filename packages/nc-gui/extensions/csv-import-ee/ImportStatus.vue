<script lang="ts" setup>
interface Props {
  status: 'inprogress' | 'compeleted' | 'failed'
  filename: string
  tablename: string
  inprogressPercentage?: number
  tableicon?: string
  inserted?: number | null
  updated?: number | null
  isOpen?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  inprogressPercentage: 0,
  inserted: null,
  updated: null,
})

const { status, inprogressPercentage, filename, tablename, tableicon, inserted, updated, isOpen } = toRefs(props)

const itemRef = ref<HTMLDivElement>()

const statusObj = computed(() => {
  return {
    inprogress: { title: 'CSV Import in Progress', icon: 'ncInfoSolid', color: 'text-nc-fill-primary' },
    compeleted: { title: 'CSV Imported', icon: 'circleCheckSolid', color: 'text-nc-fill-green-dark' },
    failed: { title: 'CSV Import Failed', icon: 'alertTriangleSolid', color: 'text-nc-fill-red-dark' },
  }[status.value]
})

const handleScroll = () => {
  if (status.value === 'inprogress') return
  itemRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}
</script>

<template>
  <div
    ref="itemRef"
    class="flex flex-col gap-4 p-3 group transition-all duration-300 border-nc-border-gray-medium cursor-pointer bg-white"
    :class="{
      'border-1 rounded-lg': status === 'inprogress',
      'border-b-1 hover:bg-nc-bg-gray-extralight ': status !== 'inprogress',
    }"
    @click="handleScroll"
  >
    <div class="w-full flex items-start flex gap-3">
      <GeneralIcon :icon="statusObj.icon" class="h-5 w-5 flex-none" :class="statusObj.color" />

      <div
        class="flex-1 text-sm flex flex-col gap-1"
        :class="{
          'w-[calc(100%_-_60px)]': status === 'inprogress',
          'w-[calc(100%_-_36px)]': status !== 'inprogress',
        }"
      >
        <div class="flex flex-col gap-2.5">
          <slot name="subtitle">
            <div class="text-sm text-nc-content-gray-subtle">
              <div class="inline-flex gap-1 bg-nc-bg-gray-medium rounded-md px-1">
                <span class="inline-flex items-center h-5">
                  <GeneralIcon icon="file" class="flex-none text-gray-600/80 h-3.5 w-3.5" />
                </span>
                <NcTooltip class="truncate max-w-[120px]" show-on-truncate-only>
                  <template #title>
                    {{ filename }}
                  </template>
                  {{ filename }}
                </NcTooltip>
              </div>

              {{
                status === 'inprogress'
                  ? 'is being imported into'
                  : status === 'compeleted'
                  ? 'has been imported into'
                  : 'has fail to import into'
              }}

              <div class="inline-flex gap-1 bg-nc-bg-gray-medium rounded-md px-1">
                <div class="inline-flex items-center">
                  <LazyGeneralEmojiPicker :emoji="tableicon" readonly size="xsmall" class="flex-none">
                    <template #default>
                      <GeneralIcon icon="table" class="min-w-4 !text-gray-500" />
                    </template>
                  </LazyGeneralEmojiPicker>
                </div>
                <NcTooltip class="truncate max-w-[120px]" show-on-truncate-only>
                  <template #title>
                    {{ tablename }}
                  </template>
                  {{ tablename }}
                </NcTooltip>
              </div>
              table.
            </div>
          </slot>
          <div v-if="$slots.error" name="error" class="text-sm text-nc-content-gray-subtle">
            <slot name="error"></slot>
          </div>
          <div v-if="$slots.timestamp" name="error" class="text-small leading-[18px] text-nc-content-gray-muted">
            <slot name="timestamp"> </slot>
          </div>
        </div>

        <div v-if="status === 'inprogress'">
          <a-progress :percent="inprogressPercentage" size="small" />
        </div>
      </div>
      <GeneralIcon
        v-if="status !== 'inprogress'"
        icon="chevronDown"
        class="h-4 w-4 flex-none transform opacity-80"
        :class="{ '!rotate-180': isOpen }"
      />
    </div>
    <div
      v-if="isOpen && status !== 'inprogress'"
      class="flex border-1 border-nc-border-gray-medium rounded-lg items-stretch children:(px-3 py-2 flex flex-col gap-2 text-sm flex-1) overflow-hidden bg-nc-bg-gray-extralight group-hover:bg-nc-bg-gray-light"
    >
      <div class="border-r-1 border-nc-border-gray-medium flex flex-col justify-between">
        <div class="text-nc-content-gray-subtle2">New records</div>
        <div class="font-weight-700 text-green-600">{{ inserted === null ? 'N/A' : inserted }}</div>
      </div>
      <div class="flex flex-col justify-between">
        <div class="text-nc-content-gray-subtle2">Updated records</div>
        <div class="font-weight-700 text-yellow-600">{{ updated === null ? 'N/A' : updated }}</div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
