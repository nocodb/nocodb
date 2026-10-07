<script setup lang="ts">
import PgDemo from '../../-components/PgDemo.vue'
import PgSection from '../../-components/PgSection.vue'

const workspaceName = ref('Acme Marketing')

const email = ref('')

const description = ref('Tracks every campaign from brief to launch, including budget and owner.')

const notes = ref('Auto-sizing textarea — keep typing and it grows.\nSecond line.')

const seats = ref(12)

const rowLimit = ref<string | number>(100)

const opacity = ref(60)

const range = ref<[number, number]>([20, 80])

const tableTitle = ref('Campaigns')

const formula = ref('')

const suggestGroups = [
  {
    key: 'fields',
    label: 'Fields',
    options: [
      { value: '{Title}', label: 'Title', description: 'Single line text' },
      { value: '{Budget}', label: 'Budget', description: 'Currency' },
      { value: '{Launch date}', label: 'Launch date', description: 'Date' },
    ],
  },
  {
    key: 'functions',
    label: 'Functions',
    options: [
      { value: 'CONCAT()', label: 'CONCAT', description: 'Joins strings' },
      { value: 'DATEADD()', label: 'DATEADD', description: 'Adds to a date' },
      { value: 'ROUND()', label: 'ROUND', description: 'Rounds a number' },
    ],
  },
]
</script>

<template>
  <PgSection
    id="inputs"
    title="Text inputs"
    source="a-input · a-textarea · NcAutoSizeTextarea · a-input-number · NcNonNullableNumberInput · a-slider · NcEditableText · NcSuggestInput"
    description="Ant inputs as styled in the product via the nc-input-* classes."
  >
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <PgDemo label="a-input" hint="nc-input-sm · nc-input-md · nc-input-shadow">
        <div class="flex flex-col gap-3">
          <a-input v-model:value="workspaceName" class="nc-input-sm nc-input-shadow" placeholder="Workspace name" />
          <a-input v-model:value="workspaceName" class="nc-input-md nc-input-shadow" placeholder="Workspace name" />
          <a-input v-model:value="email" class="nc-input-sm nc-input-shadow" placeholder="name@company.com" allow-clear>
            <template #prefix>
              <GeneralIcon icon="ncMail" class="w-4 h-4 text-nc-content-gray-muted" />
            </template>
          </a-input>
          <a-input class="nc-input-sm nc-input-shadow" placeholder="Search tables">
            <template #prefix>
              <GeneralIcon icon="search" class="w-4 h-4 text-nc-content-gray-muted" />
            </template>
            <template #suffix>
              <span class="text-captionXs text-nc-content-gray-muted">⌘K</span>
            </template>
          </a-input>
          <a-input class="nc-input-sm nc-input-shadow" value="Read only workspace" disabled />
          <a-form-item class="!mb-0" validate-status="error" help="Name must be unique in this base">
            <a-input class="nc-input-sm nc-input-shadow" value="Campaigns" />
          </a-form-item>
          <a-input-password class="nc-input-sm nc-input-shadow" value="hunter2-but-longer" />
        </div>
      </PgDemo>

      <PgDemo label="Textareas">
        <div class="flex flex-col gap-3">
          <a-textarea v-model:value="description" class="nc-input-sm nc-input-shadow" :rows="3" placeholder="Description" />
          <a-textarea class="nc-input-sm nc-input-shadow" :rows="2" value="Disabled textarea" disabled />
          <NcAutoSizeTextarea v-model="notes" placeholder="Add notes" />
          <NcAutoSizeTextarea model-value="Borderless auto-size" :bordered="false" />
        </div>
      </PgDemo>

      <PgDemo label="Numbers & sliders">
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-3">
            <span class="w-36 text-caption">a-input-number</span>
            <a-input-number v-model:value="seats" :min="1" :max="500" class="nc-input-sm nc-input-shadow !w-32" />
          </div>
          <div class="flex items-center gap-3">
            <span class="w-36 text-caption">NonNullableNumber</span>
            <NcNonNullableNumberInput v-model="rowLimit" :min="1" :max="1000" :reset-to="100" class="!w-32" />
          </div>
          <div class="flex items-center gap-3">
            <span class="w-36 text-caption">Slider {{ opacity }}%</span>
            <a-slider v-model:value="opacity" class="flex-1" />
          </div>
          <div class="flex items-center gap-3">
            <span class="w-36 text-caption">Range</span>
            <a-slider v-model:value="range" range class="flex-1" />
          </div>
          <div class="flex items-center gap-3">
            <span class="w-36 text-caption">Disabled</span>
            <a-slider :value="40" disabled class="flex-1" />
          </div>
        </div>
      </PgDemo>

      <PgDemo label="NcEditableText & NcSuggestInput" hint="double-click the title to rename">
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2 text-subHeading2">
            <GeneralIcon icon="table" class="w-4 h-4" />
            <NcEditableText v-model="tableTitle" />
          </div>
          <div class="flex items-center gap-2 text-caption text-nc-content-gray-muted">
            <NcEditableText model-value="Disabled — cannot rename" disabled />
          </div>
          <NcSuggestInput v-model="formula" :groups="suggestGroups" placeholder="Type to search fields and functions" />
        </div>
      </PgDemo>
    </div>
  </PgSection>
</template>
