<script setup lang="ts">
import { marked } from 'marked'
import VueJsonPretty from 'vue-json-pretty'
import DynamicInput from './DynamicInput.vue'

const { isRunning, isFinished, playground, resolveInput, runScript, isValidConfig } = useScriptStoreOrThrow()

const playgroundContainer = ref<HTMLElement | null>(null)

watch(
  () => playground.value.length,
  (newLength, oldLength) => {
    if (newLength > oldLength) {
      nextTick(() => {
        if (playgroundContainer.value) {
          playgroundContainer.value.scrollTop = playgroundContainer.value.scrollHeight
        }
      })
    }
  },
)

const resolve = (item: ScriptPlaygroundItem, data: any) => {
  if (item.type !== 'input-request') return
  resolveInput(item.id!, data)
}
</script>

<template>
  <div
    ref="playgroundContainer"
    class="p-6 overflow-y-auto bg-nc-bg-gray-extralight border-l-1 border-nc-border-gray-medium h-[91svh] nc-scrollbar-md"
  >
    <div v-if="isRunning || isFinished" class="flex mx-auto flex-col max-w-130 gap-6 pb-40">
      <div v-for="(item, index) in playground" :key="index" class="playground-item" :data-type="item.type">
        <template v-if="item.type === 'text'">
          <div
            class="leading-5 whitespace-pre-wrap"
            :class="{ 'text-red-500': item.style === 'error', 'text-yellow-500': item.style === 'warning' }"
          >
            {{ item.content }}
          </div>
        </template>
        <template v-else-if="item.type === 'markdown'">
          <div class="prose" v-html="marked(item.content)"></div>
        </template>
        <template v-else-if="item.type === 'table'">
          <table class="nc-scripts-table">
            <thead>
              <tr>
                <th
                  v-for="(value, key) in item.content[0] || item.content"
                  :key="key"
                  class="text-left font-semibold leading-5 p-2"
                >
                  {{ key }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) in Array.isArray(item.content) ? item.content : [item.content]" :key="rowIndex">
                <td v-for="(value, key) in row" :key="key" class="text-nc-content-gray-subtle leading-5 px-2 py-1">
                  {{ value }}
                </td>
              </tr>
            </tbody>
          </table>
        </template>
        <template v-else-if="item.type === 'inspect'">
          <VueJsonPretty
            :show-double-quotes="false"
            :highlight-selected-node="false"
            :show-line="false"
            :deep="2"
            :data="item.content"
          />
        </template>
        <template v-else-if="item.type === 'input-request'">
          <DynamicInput :content="item.content" :on-resolve="(data: any) => resolve(item, data)" />
        </template>
      </div>
    </div>

    <div v-else class="flex items-center flex-col gap-3 h-full justify-center">
      <NcTooltip :disabled="isValidConfig">
        <NcButton size="small" type="primary" :disabled="!isValidConfig" :loading="isRunning" @click="runScript">
          <div class="flex gap-2 items-center">
            <GeneralIcon icon="ncPlay" />
            Run
          </div>
        </NcButton>

        <template #title> Setup script settings first to execute </template>
      </NcTooltip>
    </div>
  </div>
</template>

<style scoped lang="scss">
:deep(.vjs-tree) {
  .vjs-tree-node:hover {
    @apply !bg-nc-bg-gray-light;
  }

  .vjs-key {
    @apply !text-nc-content-gray-subtle2;
  }

  .vjs-value {
    @apply !text-nc-content-gray-subtle;
  }
}

.nc-scripts-table {
  @apply border-1 border-separate rounded-md border-gray-300 w-full border-1 border-nc-gray-medium;
  border-spacing: 0px;

  thead {
    @apply rounded-t-lg;
    th {
      @apply border-r-1 first:rounded-tl-lg last:rounded-tr-lg last:border-r-0 bg-nc-bg-gray-extralight;
    }
  }

  tbody {
    @apply bg-white;
    tr {
      td {
        @apply border-r-1 border-t-1 last:rounded-br-lg first:rounded-bl-lg last:border-r-0 border-nc-gray-medium;
      }
    }
  }
}

:deep(.prose) {
  @apply !max-w-auto;

  a {
    @apply text-gray-900;
  }

  h1 {
    @apply text-Heading1 text-nc-content-gray;
    font-weight: 700;
  }

  h2 {
    @apply text-Heading3 text-nc-content-gray;
  }

  h3 {
    @apply text-subHeading1 text-nc-content-gray;
  }

  h4 {
    @apply text-subHeading2 text-nc-content-gray;
  }

  h5 {
    @apply text-bodyBold text-nc-content-gray;
  }

  p {
    @apply text-nc-content-gray-emphasis caption;
  }

  li {
    @apply text-nc-content-gray-emphasis leading-6;
    font-size: 14px !important;
  }

  h3 {
    @apply text-nc-content-gray-emphasis text-lg leading-6 mb-0;
  }

  img {
    @apply !my-4;
  }
}

.playground-item[data-type='text'] + .playground-item[data-type='text'] {
  margin-top: -18px;
}
</style>
