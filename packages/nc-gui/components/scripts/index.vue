<script setup lang="ts">
import { loadPyodide } from 'pyodide'

const props = defineProps<{
  modalVisible: boolean
}>()

const emits = defineEmits(['update:modalVisible'])

const modalVisible = useVModel(props, 'modalVisible', emits)

const { execScript } = useScripts()

const script = ref('')

const closeModel = () => {
  modalVisible.value = false
}

const loading = ref(false)

const response = ref('')

const executeJSScript = async () => {
  loading.value = true
  try {
    const res = await execScript(script.value)
    response.value = JSON.stringify(res, null, 2)
  } catch (e) {
    response.value = e.message
  } finally {
    loading.value = false
  }
}

const executePythonScript = async () => {
  loading.value = true
  try {
    const pyodide = await loadPyodide()
    const res = await pyodide.runPythonAsync(script.value)
    response.value = JSON.stringify(res, null, 2)
  } catch (e) {
    response.value = e.message
  } finally {
    loading.value = false
  }
}

const supportedDocs = [
  {
    title: 'Scripting Guide',
    href: 'https://docs.nocodb.com/docs/scripting-guide',
  },
  {
    title: 'Scripting API',
    href: 'https://docs.nocodb.com/docs/scripting-api',
  },
  {
    title: 'Scripting Examples',
    href: 'https://docs.nocodb.com/docs/scripting-examples',
  },
]
</script>

<template>
  <NcModal v-model:visible="modalVisible" :show-separator="true" size="large" wrap-class-name="nc-modal-scripts-create-edit">
    <template #header>
      <div class="flex w-full items-center p-4 justify-between">
        <div class="flex items-center gap-3">
          <GeneralIcon class="text-gray-900 text-2xl" icon="ncScript" />
          <span class="text-gray-900 font-semibold text-xl"> Scripts Editor </span>
        </div>

        <div class="flex justify-end items-center gap-3">
          <NcButton :loading="loading" type="primary" size="small" data-testid="nc-test-script" @click="executeJSScript">
            Test JS Script
          </NcButton>

          <NcButton :loading="loading" type="primary" size="small" data-testid="nc-test-script" @click="executePythonScript">
            Test Python Script
          </NcButton>

          <NcButton type="text" size="small" data-testid="nc-close-scripts-modal" @click.stop="closeModel">
            <GeneralIcon icon="close" />
          </NcButton>
        </div>
      </div>
    </template>
    <div class="flex bg-white rounded-b-2xl h-[calc(100%_-_66px)]">
      <div
        ref="containerElem"
        class="h-full flex-1 flex flex-col gap-8 overflow-y-auto scroll-smooth nc-scrollbar-thin px-12 py-6 mx-auto"
      >
        <iframe
          src="http://localhost:8080/api/v2/scripts"
          class="iframe-container"
          sandbox="allow-scripts allow-forms allow-same-origin allow-modals allow-popups allow-presentation"
          allow="geolocation *; microphone *; camera *; midi *; encrypted-media *;"
          referrerpolicy="no-referrer"
          loading="lazy"
          importance="high"
          height="100%"
          frameborder="0"
          scrolling="no"
        ></iframe>
      </div>

      <div class="h-full bg-gray-50 border-l-1 w-80 p-5 rounded-br-2xl border-gray-200">
        <div class="w-full flex flex-col gap-3">
          <h2 class="text-sm text-gray-700 font-semibold !my-0">{{ $t('labels.supportDocs') }}</h2>
          <div>
            <div v-for="(doc, idx) of supportedDocs" :key="idx" class="flex items-center gap-1">
              <div class="h-7 w-7 flex items-center justify-center">
                <GeneralIcon icon="bookOpen" class="flex-none w-4 h-4 text-gray-500" />
              </div>
              <NuxtLink
                :href="doc.href"
                target="_blank"
                rel="noopener noreferrer"
                class="!text-gray-500 text-sm !no-underline !hover:underline"
              >
                {{ doc.title }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-scripts-create-edit {
  z-index: 1050;
  a {
    @apply !no-underline !text-gray-700 !hover:text-primary;
  }
  .nc-modal {
    @apply !p-0;
    height: min(calc(100vh - 100px), 1024px);
    max-height: min(calc(100vh - 100px), 1024px) !important;
  }

  .nc-modal-header {
    @apply !mb-0 !pb-0;
  }
}
</style>
