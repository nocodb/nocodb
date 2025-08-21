<script setup lang="ts">
import { marked } from 'marked'
import VueJsonPretty from 'vue-json-pretty'
import DynamicInput from './DynamicInput.vue'
import { ScriptActionType } from '~/lib/enum'

interface Props {
  playground?: any[]
  isRunning?: boolean
  isFinished?: boolean
  showRunButton?: boolean
  compact?: boolean
  containerClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  playground: undefined,
  isRunning: false,
  isFinished: false,
  showRunButton: true,
  compact: false,
  containerClass: '',
})

const scriptStore = props.playground ? null : useScriptStoreOrThrow()
const playgroundData = computed(() => props.playground || scriptStore?.playground.value || [])
const isRunningState = computed(() => props.isRunning || scriptStore?.isRunning.value || false)
const isFinishedState = computed(() => props.isFinished || scriptStore?.isFinished.value || false)

const playgroundContainer = ref<HTMLElement | null>(null)

watch(
  () => playgroundData.value.length,
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

// Helper function to find input item in playground
const findInputItemInPlayground = (items: any[], id: string): { item: any; index: number; parent?: any } | null => {
  for (let i = 0; i < items.length; i++) {
    const item = items[i]

    if (item?.id === id && item.type === 'input-request') {
      return { item, index: i }
    }

    // If it's a workflow step, search in its children
    if (item.type === 'workflow-step') {
      for (let j = 0; j < item.content.children.length; j++) {
        const child = item.content.children[j]
        if (child?.id === id && child.type === 'input-request') {
          return {
            item: child,
            index: j,
            parent: item,
          }
        }
      }
    }
  }
  return null
}

// Function to resolve input for external playground (Action Pane)
const resolveExternalInput = (id: string, value: string | Record<string, any> | any) => {
  const { activeExecutions } = useScriptExecutor()

  // Find the execution that contains this input item
  for (const [_, execution] of activeExecutions.value) {
    const result = findInputItemInPlayground(execution.playground, id)
    if (result) {
      const { item } = result

      // Call the resolve function on the input item
      if (item?.resolve) {
        if (typeof value === 'object') {
          value = JSON.stringify(value)
        }
        item.resolve(value)
      }

      // Send message to worker
      execution.worker?.postMessage({
        type: ScriptActionType.INPUT_RESOLVED,
        payload: { id, value },
      })

      break
    }
  }
}

const resolve = (item: ScriptPlaygroundItem, data: any) => {
  if (item.type !== 'input-request') return
  if (scriptStore) {
    scriptStore.resolveInput(item.id!, data)
  } else {
    // Handle input resolution for external playground (Action Pane)
    resolveExternalInput(item.id!, data)
  }
}
</script>

<template>
  <div
    ref="playgroundContainer"
    class="overflow-y-auto nc-scrollbar-md"
    :class="[
      {
        'border-l-1 border-nc-border-gray-medium': !compact && scriptStore?.isCreateEditScriptAllowed,
        'p-6 h-[91svh] bg-nc-bg-gray-extralight max-w-130': !compact,
      },
      containerClass,
    ]"
  >
    <div
      v-if="isRunningState || isFinishedState || playgroundData.length > 0"
      class="flex mx-auto flex-col gap-6"
      :class="[{ 'pb-40': !compact, 'pb-4': compact }]"
    >
      <div v-for="(item, index) in playgroundData" :key="index" class="playground-item" :data-type="item.type">
        <template v-if="item.type === 'workflow-step'">
          <div
            :class="{
              'bg-nc-bg-blue-light border-nc-border-blue': item.content.color === 'blue',
              'bg-nc-bg-red-light border-nc-border-red': item.content.color === 'red',
              'bg-nc-bg-green-light border-nc-border-green': item.content.color === 'green',
              'bg-nc-bg-yellow-light border-nc-border-yellow': item.content.color === 'yellow',
              'bg-nc-bg-purple-light border-nc-border-purple': item.content.color === 'purple',
              'bg-nc-bg-orange-light border-nc-border-orange': item.content.color === 'orange',
              'bg-nc-bg-pink-light border-nc-border-pink': item.content.color === 'pink',
              'bg-nc-bg-maroon-light border-nc-border-maroon': item.content.color === 'maroon',
              'bg-white border-nc-border-gray-dark': !item.content.color || item.content.color === 'gray',
            }"
            class="workflow-step-card border-1 rounded-lg overflow-hidden"
          >
            <div
              :class="{
                'border-nc-border-blue': item.content.color === 'blue',
                'border-nc-border-red': item.content.color === 'red',
                'border-nc-border-green': item.content.color === 'green',
                'border-nc-border-yellow': item.content.color === 'yellow',
                'border-nc-border-purple': item.content.color === 'purple',
                'border-nc-border-orange': item.content.color === 'orange',
                'border-nc-border-pink': item.content.color === 'pink',
                'border-nc-border-maroon': item.content.color === 'maroon',
                'border-nc-border-gray-dark': !item.content.color || item.content.color === 'gray',
              }"
              class="step-header px-4 py-4 border-b border-gray-200"
            >
              <div class="flex items-center gap-4">
                <div v-if="item.content.icon" class="step-icon">
                  <GeneralIcon :icon="item.content.icon" class="w-6 h-6" />
                </div>
                <div
                  :class="{
                    'text-nc-content-blue-dark': item.content.color === 'blue',
                    'text-nc-content-red-dark': item.content.color === 'red',
                    'text-nc-content-green-dark': item.content.color === 'green',
                    'text-nc-content-yellow-dark': item.content.color === 'yellow',
                    'text-nc-content-purple-dark': item.content.color === 'purple',
                    'text-nc-content-orange-dark': item.content.color === 'orange',
                    'text-nc-content-pink-dark': item.content.color === 'pink',
                    'text-nc-content-maroon-dark': item.content.color === 'maroon',
                    'text-nc-content-gray-emphasis': !item.content.color,
                  }"
                  class="text-subHeading2"
                >
                  {{ item.content.title }}
                </div>
              </div>
              <div v-if="item.content.description" class="text-caption mt-4 text-nc-content-gray-subtle">
                {{ item.content.description }}
              </div>
            </div>

            <!-- Step Content -->
            <div v-if="item.content.children.length > 0" class="step-content p-4 space-y-4">
              <div v-for="(child, childIndex) in item.content.children" :key="childIndex">
                <!-- Render child items using existing templates -->
                <template v-if="child.type === 'text'">
                  <div
                    class="leading-5 whitespace-pre-wrap text-sm"
                    :class="{
                      'text-red-500': child.style === 'error',
                      'text-orange-500': child.style === 'warning',
                    }"
                  >
                    {{ child.content }}
                  </div>
                </template>

                <template v-else-if="child.type === 'markdown'">
                  <div class="prose" v-html="marked(child.content)"></div>
                </template>

                <template v-else-if="child.type === 'table'">
                  <table class="nc-scripts-table">
                    <thead>
                      <tr>
                        <th
                          v-for="(value, key) in child.content[0] || child.content"
                          :key="key"
                          class="text-left font-semibold leading-5 p-2"
                        >
                          {{ key }}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(row, rowIndex) in Array.isArray(child.content) ? child.content : [child.content]"
                        :key="rowIndex"
                      >
                        <td v-for="(value, key) in row" :key="key" class="text-nc-content-gray-subtle leading-5 px-2 py-1">
                          {{ value }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </template>

                <template v-else-if="child.type === 'inspect'">
                  <VueJsonPretty
                    :show-double-quotes="false"
                    :highlight-selected-node="false"
                    :show-line="false"
                    :deep="2"
                    :data="child.content"
                  />
                </template>

                <template v-else-if="child.type === 'input-request'">
                  <DynamicInput :content="child.content" :on-resolve="(data: any) => resolve(child, data)" />
                </template>
              </div>
            </div>
          </div>
        </template>

        <!-- Regular items (not in workflow steps) -->
        <template v-else-if="item.type === 'text'">
          <div
            class="leading-5 whitespace-pre-wrap"
            :class="{ 'text-red-500': item.style === 'error', 'text-orange-500': item.style === 'warning' }"
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

    <div v-else-if="showRunButton && scriptStore" class="flex items-center flex-col gap-3 h-full justify-center">
      <NcTooltip :disabled="scriptStore.isValidConfig">
        <NcButton
          size="small"
          type="primary"
          :disabled="!scriptStore.isValidConfig"
          :loading="isRunningState"
          @click="scriptStore.runScript"
        >
          <div class="flex gap-2 items-center">
            <GeneralIcon icon="ncPlay" />
            Run
          </div>
        </NcButton>

        <template #title> Setup script settings first to execute </template>
      </NcTooltip>
    </div>

    <div
      v-else-if="playgroundData.length === 0 && !showRunButton"
      class="flex items-center justify-center h-20 text-nc-content-gray-subtle text-sm"
    >
      No execution steps yet...
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
  @apply border-1 border-separate rounded-md border-gray-300 w-full border-1 border-nc-border-gray-medium;
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
        @apply border-r-1 border-t-1 last:rounded-br-lg first:rounded-bl-lg last:border-r-0 border-nc-border-gray-medium;
      }
    }
  }
}

.workflow-step-card {
  @apply shadow-sm;
}

.step-header {
  @apply relative;
}

.step-content {
  @apply relative;
}

:deep(.prose) {
  @apply !max-w-auto;

  a {
    @apply text-gray-900;
  }

  h1 {
    @apply text-heading1 text-nc-content-gray;
    font-weight: 700;
  }

  h2 {
    @apply text-heading3 text-nc-content-gray;
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
    @apply text-nc-content-gray-emphasis text-caption;
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
