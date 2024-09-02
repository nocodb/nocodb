<script lang="ts" setup>
import { marked } from 'marked'

interface Prop {
  modelValue: boolean
  extensionId: string
  from: 'market' | 'extension'
}

const props = defineProps<Prop>()

const emit = defineEmits(['update:modelValue'])

const vModel = useVModel(props, 'modelValue', emit)

const { availableExtensions, descriptionContent, addExtension, getExtensionAssetsUrl, isMarketVisible } = useExtensions()

const onBack = () => {
  vModel.value = false
  isMarketVisible.value = true
}

const onAddExtension = (ext: any) => {
  addExtension(ext)
  vModel.value = false
}

const activeExtension = computed(() => {
  return availableExtensions.value.find((ext) => ext.id === props.extensionId)
})

// Create a custom renderer
const renderer = new marked.Renderer()

// Override the image function to modify the URL
renderer.image = function (href: string, title: string | null, text: string) {
  // Modify the URL here
  const newUrl = getExtensionAssetsUrl(href)

  return `<img src="${newUrl}" alt="${text}" title="${title || ''}">`
}

// Apply the custom renderer to marked
marked.use({ renderer })

const getModifiedContent = (content = '') => {
  // Modify raw <img> tags, supporting both single and double quotes
  return content.replace(/<img\s+src=(["'])(.*?)\1(.*?)>/g, (match, quote, src, rest) => {
    const newSrc = getExtensionAssetsUrl(src)
    return `<img src=${quote}${newSrc}${quote}${rest}>`
  })
}

const detailsBody = computed(() => {
  if (descriptionContent.value[props.extensionId]) {
    return marked.parse(getModifiedContent(descriptionContent.value[props.extensionId]))
  } else if (activeExtension.value?.description) {
    return marked.parse(getModifiedContent(activeExtension.value.description))
  }

  return '<p></p>'
})
</script>

<template>
  <NcModal
    v-model:visible="vModel"
    :class="{ active: vModel }"
    :footer="null"
    :width="1154"
    size="medium"
    wrap-class-name="nc-modal-extension-details"
  >
    <div v-if="activeExtension" class="flex flex-col w-full h-full">
      <div class="flex items-center gap-3 p-4 border-b-1 border-gray-200">
        <NcButton v-if="from === 'market'" size="small" type="text" @click="onBack">
          <GeneralIcon icon="arrowLeft" />
        </NcButton>

        <img :src="getExtensionAssetsUrl(activeExtension.iconUrl)" alt="icon" class="h-[50px] w-[50px] object-contain" />
        <div class="flex-1 flex flex-col">
          <div class="font-semibold text-xl truncate">{{ activeExtension.title }}</div>
          <div class="text-small leading-[18px] text-gray-500 truncate">{{ activeExtension.subTitle }}</div>
        </div>
        <div class="self-start flex items-center gap-2.5">
          <NcButton size="small" class="w-full" @click="onAddExtension(activeExtension)">
            <div class="flex items-center justify-center gap-1 -ml-3px">
              <GeneralIcon icon="plus" /> {{ $t('general.add') }} {{ $t('general.extension') }}
            </div>
          </NcButton>
          <NcButton size="small" type="text" @click="vModel = false">
            <GeneralIcon icon="close" class="text-gray-600" />
          </NcButton>
        </div>
      </div>

      <div class="extension-details">
        <div class="extension-details-left">
          <div class="nc-extension-details-body" v-html="detailsBody"></div>
        </div>
        <div class="extension-details-right">
          <div class="extension-details-right-section">
            <div class="extension-details-right-title">Version</div>
            <div class="extension-details-right-subtitle">{{ activeExtension.version }}</div>
          </div>
          <NcDivider />
          <div class="extension-details-right-section">
            <div v-if="activeExtension.publisherName" class="extension-details-right-title">Publisher</div>
            <div class="extension-details-right-subtitle">{{ activeExtension.publisherName }}</div>
          </div>
          <template v-if="activeExtension.publisherEmail">
            <NcDivider />
            <div class="extension-details-right-section">
              <div class="extension-details-right-title">Publisher Email</div>
              <div class="extension-details-right-subtitle">
                <a :href="`mailto:${activeExtension.publisherEmail}`" target="_blank" rel="noopener noreferrer">
                  {{ activeExtension.publisherEmail }}
                </a>
              </div>
            </div>
          </template>
          <template v-if="activeExtension.publisherUrl">
            <NcDivider />
            <div class="extension-details-right-section">
              <div class="extension-details-right-title">Publisher Website</div>
              <div class="extension-details-right-subtitle">
                <a :href="activeExtension.publisherUrl" target="_blank" rel="noopener noreferrer">
                  {{ activeExtension.publisherUrl }}
                </a>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss" scoped>
.extension-details {
  @apply flex w-full h-[calc(100%_-_65px)];

  .extension-details-left {
    @apply p-6 flex-1 flex flex-col gap-6 nc-scrollbar-thin;
  }

  .extension-details-right {
    @apply p-5 w-[320px] flex flex-col space-y-4 border-l-1 border-gray-200 bg-gray-50 nc-scrollbar-thin;

    .extension-details-right-section {
      @apply flex flex-col gap-2;
    }

    .extension-details-right-title {
      @apply text-sm font-semibold text-gray-800;
    }
    .extension-details-right-subtitle {
      @apply text-sm font-weight-500 text-gray-600;
    }
  }
}
</style>

<style lang="scss">
.nc-modal-extension-details {
  .ant-modal-content {
    @apply overflow-hidden;
  }
  .nc-modal {
    @apply !p-0;
    height: min(calc(100vh - 100px), 1024px);
    max-height: min(calc(100vh - 100px), 1024px) !important;

    .nc-edit-or-add-integration-left-panel {
      @apply w-full p-6 flex-1 flex justify-center;
    }
    .nc-edit-or-add-integration-right-panel {
      @apply p-5 w-[320px] border-l-1 border-gray-200 flex flex-col gap-4 bg-gray-50 rounded-br-2xl;
    }
  }

  .nc-extension-details-body {
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
