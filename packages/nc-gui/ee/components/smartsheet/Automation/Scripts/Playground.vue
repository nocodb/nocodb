<script setup lang="ts">
import { marked } from 'marked'
import VueJsonPretty from 'vue-json-pretty'
import DynamicInput from './DynamicInput.vue'

const { isRunning, isFinished, playground, resolveInput, runScript } = useScriptStoreOrThrow()
</script>

<template>
  <div class="w-full flex flex-col p-6 w-full h-full bg-nc-bg-gray-extralight text-gray-800 overflow-hidden">
    <div ref="playgroundRef" class="flex-grow h-full overflow-y-auto">
      <template v-if="isRunning || isFinished">
        <div v-for="(item, index) in playground" :key="index" class="mb-4">
          <template v-if="item.type === 'text'">
            <div
              class="leading-5"
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
            <VueJsonPretty :show-double-quotes="false" highlight-selected-node :deep="2" :data="item.content" />
          </template>
          <template v-else-if="item.type === 'input-request'">
            <DynamicInput :content="item.content" :on-resolve="(value) => resolveInput(item.id!, value)" />
          </template>
        </div>
      </template>
      <template v-else>
        <div class="flex items-center flex-col gap-3 h-full justify-center">
          <NcButton size="small" type="primary" :loading="isRunning" @click="runScript">
            <div class="flex gap-2 items-center">
              <GeneralIcon icon="ncPlay" />
              Run
            </div>
          </NcButton>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
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
    @apply text-3xl text-nc-content-gray-emphasis leading-9 mb-0;
    font-weight: 700;
  }

  h2 {
    @apply text-nc-content-gray-emphasis text-xl leading-6 !my-4;
  }

  p {
    @apply text-nc-content-gray-emphasis leading-6;
    font-size: 14px !important;
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
</style>
