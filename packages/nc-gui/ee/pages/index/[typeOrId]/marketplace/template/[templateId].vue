<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMarketplaceTemplates } from '~/ee/composables/useMarketplaceTemplates'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()
const templateId = computed(() => route.params.templateId)
const typeOrId = computed(() => route.params.typeOrId)

// Use the shared marketplace templates composable
const { activeCategory, getTemplateById } = useMarketplaceTemplates('marketplace')

const template = ref(null)
const isLoading = ref(true)
const error = ref(null)

// Get template details
const fetchTemplateDetails = async () => {
  isLoading.value = true
  error.value = null

  try {
    template.value = await getTemplateById(templateId.value)
  } catch (err) {
    console.error('Failed to fetch template details:', err)
    error.value = 'Failed to load template details'
  } finally {
    isLoading.value = false
  }
}

// Go back to the previous page
const goBack = () => {
  router.back()
}

// Open template in new tab
const useTemplate = () => {
  if (template.value && template.value['Shared Base Url']) {
    window.open(template.value['Shared Base Url'], '_blank')
  }
}

onMounted(() => {
  fetchTemplateDetails()
})
</script>

<template>
  <div class="marketplace-container">
    <MarketplaceHeader />
    <div class="flex container h-[calc(100vh_-_80px)] gap-8 mt-8 mx-auto">
      <MarketplaceSidebar v-model:active-category="activeCategory" class="sticky top-0" />
      <div class="flex-1 flex flex-col">
        <!-- Back button -->
        <div class="mb-4">
          <button class="flex items-center text-primary hover:underline" @click="goBack">
            <span class="i-mdi-arrow-left mr-1"></span>
            Back to Templates
          </button>
        </div>

        <div v-if="isLoading" class="flex justify-center items-center h-64">
          <GeneralLoader size="large" />
        </div>

        <div v-else-if="error" class="flex flex-col items-center justify-center py-12">
          <div class="text-nc-content-gray-subtle2 text-lg">{{ error }}</div>
          <button class="mt-4 btn-primary" @click="fetchTemplateDetails">Retry</button>
        </div>

        <div v-else-if="template" class="template-detail">
          <div class="flex flex-col md:flex-row gap-8">
            <!-- Template image -->
            <div class="md:w-1/3">
              <img
                :src="template.Thumbnail || '/placeholder-image.png'"
                :alt="template.Title"
                class="w-full rounded-lg shadow-lg"
              />
            </div>

            <!-- Template details -->
            <div class="md:w-2/3">
              <h1 class="text-2xl font-bold text-nc-content-gray mb-2">{{ template.Title }}</h1>
              <div class="text-nc-content-gray-subtle2 mb-6">{{ template.Description }}</div>

              <div class="mb-6">
                <h3 class="text-lg font-semibold mb-2">Features</h3>
                <ul class="list-disc pl-5 space-y-1">
                  <li
                    v-for="(feature, index) in template.Features || [
                      'Easy to customize',
                      'Pre-built workflows',
                      'Ready-to-use templates',
                    ]"
                    :key="index"
                  >
                    {{ feature }}
                  </li>
                </ul>
              </div>

              <div class="mb-6">
                <h3 class="text-lg font-semibold mb-2">Use Cases</h3>
                <div class="text-nc-content-gray-subtle2">
                  {{
                    template.UseCases ||
                    'Perfect for teams looking to streamline their workflow, track progress, and manage resources effectively.'
                  }}
                </div>
              </div>

              <button class="btn-primary" @click="useTemplate">Use This Template</button>
            </div>
          </div>

          <!-- Additional template information -->
          <div class="mt-12">
            <h2 class="text-xl font-bold mb-4">About this template</h2>
            <div class="prose max-w-none">
              {{ template.LongDescription || template.Description }}
            </div>
          </div>

          <!-- Related templates section -->
          <div v-if="template.RelatedTemplates && template.RelatedTemplates.length" class="mt-12">
            <h2 class="text-xl font-bold mb-4">Related Templates</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div v-for="relatedTemplate in template.RelatedTemplates" :key="relatedTemplate.Id" class="template-card">
                <!-- Related template card content -->
              </div>
            </div>
          </div>
        </div>

        <div v-else class="flex flex-col items-center justify-center py-12">
          <div class="text-nc-content-gray-subtle2 text-lg">Template not found</div>
          <button class="mt-4 btn-primary" @click="goBack">Back to Templates</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.template-card {
  transition: transform 0.2s ease-in-out;
  will-change: transform;

  &:hover {
    transform: translateY(-4px);
  }
}

.btn-primary {
  @apply bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark transition-colors;
}
</style>
