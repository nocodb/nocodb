<script lang="ts" setup>
import { marked } from 'marked'
import { PlanFeatureTypes } from 'nocodb-sdk'

interface Prop {
  modelValue: boolean
  scriptId: string
}

const props = defineProps<Prop>()

const emit = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emit)

const automationStore = useAutomationStore()

const bases = useBases()
const { openedProject } = storeToRefs(bases)

const { getScriptAssetsURL, getScriptContent, createAutomation } = automationStore

const { availableScripts, descriptionContent, isMarketVisible } = storeToRefs(automationStore)

const { blockAddNewScript, navigateToPricing, isWsOwner } = useEeConfig()

const onBack = () => {
  vModel.value = false
  isMarketVisible.value = true
}

const scriptContent = computed(() => {
  return getScriptContent(props.scriptId)
})

const onAddScript = async (scr: any) => {
  await createAutomation(openedProject.value?.id, {
    title: scr.title,
    script: scriptContent.value,
    description: scr.subTitle,
  })
  vModel.value = false
}

const activeScript = computed(() => {
  return availableScripts.value.find((scr) => scr.id === props.scriptId)
})

// Create a custom renderer
const renderer = new marked.Renderer()

// Override the image function to modify the URL
renderer.image = function (href: string, title: string | null, text: string) {
  // Modify the URL here
  const newUrl = getScriptAssetsURL(href)

  return `<img src="${newUrl}" alt="${text}" title="${title || ''}">`
}

// Apply the custom renderer to marked
marked.use({ renderer })

const getModifiedContent = (content = '') => {
  // Modify raw <img> tags, supporting both single and double quotes
  return content.replace(/<img\s+src=(["'])(.*?)\1(.*?)>/g, (match, quote, src, rest) => {
    const newSrc = getScriptAssetsURL(src)
    return `<img src=${quote}${newSrc}${quote}${rest}>`
  })
}

const detailsBody = computed(() => {
  if (descriptionContent.value[props.scriptId]) {
    return marked.parse(getModifiedContent(descriptionContent.value[props.scriptId]))
  } else if (activeScript.value?.description) {
    return marked.parse(getModifiedContent(activeScript.value.description))
  }

  return '<p></p>'
})
</script>

<template>
  <NcModal
    v-model:visible="vModel"
    :class="{ active: vModel }"
    :footer="null"
    size="lg"
    wrap-class-name="nc-modal-scripts-details"
  >
    <div v-if="activeScript" class="flex flex-col w-full h-full">
      <div class="flex items-center gap-3 px-4 py-3 border-b-1 border-gray-200">
        <NcButton size="small" type="text" @click="onBack">
          <GeneralIcon icon="arrowLeft" />
        </NcButton>

        <img :src="getScriptAssetsURL(activeScript.iconUrl)" alt="icon" class="h-[50px] w-[50px] object-contain" />
        <div class="flex-1 flex flex-col">
          <div class="font-semibold text-xl truncate">{{ activeScript.title }}</div>
          <div class="text-small leading-[18px] text-gray-500 truncate">{{ activeScript.subTitle }}</div>
        </div>
        <div class="self-start flex items-center gap-2.5">
          <NcButton v-if="!blockAddNewScript" size="small" class="w-full" @click="onAddScript(activeScript)">
            <div class="flex items-center justify-center gap-1 -ml-3px">
              <GeneralIcon icon="plus" /> {{ $t('general.add') }} {{ $t('general.script') }}
            </div>
          </NcButton>
          <NcTooltip v-else>
            <template #title>
              {{ $t('upgrade.upgradeToAddMoreScripts') }}
            </template>
            <NcButton
              size="small"
              class="w-full nc-upgrade-plan-btn"
              @click="navigateToPricing({ limitOrFeature: PlanFeatureTypes.FEATURE_SCRIPTS })"
            >
              <div class="flex items-center justify-center gap-2">
                <GeneralIcon icon="ncArrowUpCircle" class="h-4 w-4" />

                {{ isWsOwner ? $t('upgrade.upgradeToAdd') : $t('upgrade.requestUpgradeToAdd') }}
              </div>
            </NcButton>
          </NcTooltip>
          <NcButton size="small" type="text" @click="vModel = false">
            <GeneralIcon icon="close" class="text-gray-600" />
          </NcButton>
        </div>
      </div>

      <div class="script-details">
        <div class="script-details-left">
          <div class="nc-script-details-body" v-html="detailsBody"></div>
          <ScriptsSource class="max-w-[768px] w-full mx-auto" :code="scriptContent" />
        </div>
        <div class="script-details-right">
          <div class="script-details-right-section">
            <div class="script-details-right-title">Version</div>
            <div class="script-details-right-subtitle">{{ activeScript.version }}</div>
          </div>

          <NcDivider />
          <div v-if="activeScript.publisher" class="script-details-right-section">
            <div class="script-details-right-title">Publisher</div>
            <div class="flex items-center gap-2">
              <img
                v-if="activeScript.publisher?.icon?.src"
                :src="getScriptAssetsURL(activeScript.publisher.icon.src)"
                alt="Publisher icon"
                class="object-contain flex-none"
                :style="{
                  width: activeScript.publisher?.icon?.width ? `${activeScript.publisher?.icon?.width}px` : '24px',
                  height: activeScript.publisher?.icon?.height ? `${activeScript.publisher?.icon?.height}px` : '24px',
                }"
              />
              <div class="script-details-right-subtitle">{{ activeScript.publisher.name }}</div>
            </div>
            <div class="flex items-center gap-3 text-sm font-semibold text-nc-content-brand">
              <a
                v-if="activeScript.publisher?.url"
                :href="activeScript.publisher.url"
                target="_blank"
                rel="noopener noreferrer"
                class="!no-underline !hover:underline"
              >
                Website
              </a>
              <template v-if="activeScript.publisher?.email">
                <div class="border-l-1 border-nc-border-gray-medium h-5"></div>
                <a
                  :href="`mailto:${activeScript.publisher.email}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="!no-underline !hover:underline"
                >
                  Contact
                </a>
              </template>
            </div>
          </div>
          <template v-if="activeScript.links && activeScript.links.length">
            <NcDivider />
            <div class="script-details-right-section">
              <div class="script-details-right-title">Links</div>
              <div>
                <div v-for="(doc, idx) of activeScript.links" :key="idx" class="flex items-center gap-1">
                  <div class="h-7 w-7 flex items-center justify-center">
                    <GeneralIcon icon="bookOpen" class="flex-none w-4 h-4 text-gray-600" />
                  </div>
                  <a
                    :href="doc.href"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="!text-gray-700 text-sm !no-underline !hover:underline"
                  >
                    {{ doc.title }}
                  </a>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
.script-details {
  @apply flex w-full h-[calc(100%_-_75px)];

  .script-details-left {
    @apply p-6 flex-1 flex flex-col gap-6 nc-scrollbar-thin;
  }

  .script-details-right {
    @apply p-5 w-[320px] flex flex-col space-y-4 border-l-1 border-gray-200 bg-gray-50 nc-scrollbar-thin;

    .script-details-right-section {
      @apply flex flex-col gap-3;
    }

    .script-details-right-title {
      @apply text-sm font-semibold text-gray-800;
    }
    .script-details-right-subtitle {
      @apply text-sm font-weight-500 text-gray-600;
    }
  }
}
</style>

<style lang="scss">
.nc-modal-scripts-details {
  .ant-modal-content {
    @apply overflow-hidden;
  }
  .nc-modal {
    @apply !p-0;
  }

  .nc-script-details-body {
    @apply max-w-[768px] mx-auto;

    p {
      @apply !m-0 !leading-5;
    }

    ul {
      li {
        @apply ml-4;
        list-style-type: disc;
      }
    }

    ol {
      @apply !pl-4;
      li {
        list-style-type: decimal;
      }
    }

    ul,
    ol {
      @apply !my-0;
    }

    // Pre tag is the parent wrapper for Code block
    pre {
      @apply overflow-auto mt-3 bg-gray-100;

      border-color: #d0d5dd;
      border: 1px;
      color: black;
      font-family: 'JetBrainsMono', monospace;
      padding: 1rem;
      border-radius: 0.5rem;
      height: fit-content;

      code {
        @apply !px-0;
      }
    }

    code {
      @apply rounded-md px-2 py-1 bg-gray-100;

      color: inherit;
      font-size: 0.8rem;
    }

    blockquote {
      border-left: 3px solid #d0d5dd;
      padding: 0 1em;
      color: #666;
      margin: 1em 0;
      font-style: italic;
    }

    hr {
      @apply !border-gray-300;

      border: 0;
      border-top: 1px solid #ccc;
      margin: 1.5em 0;
    }

    h1 {
      font-weight: 700;
      font-size: 1.85rem;
      margin-bottom: 0.1rem;
      line-height: 36px;
    }

    h2 {
      font-weight: 600;
      font-size: 1.55rem;
      margin-bottom: 0.1em;
      line-height: 30px;
    }

    h3 {
      font-weight: 600;
      font-size: 1.15rem;
      margin-bottom: 0.1em;
      line-height: 24px;
    }
  }
}
</style>
