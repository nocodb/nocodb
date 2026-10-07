<script setup lang="ts">
import PgDemo from '../../-components/PgDemo.vue'
import PgSection from '../../-components/PgSection.vue'

const COLORS = ['', 'brand', 'ai', 'purple', 'blue', 'green', 'orange', 'yellow', 'red', 'maroon', 'gray'] as const

const SIZES = ['xs', 'sm', 'md', 'lg'] as const

const ROUNDED = ['sm', 'md', 'lg'] as const

const OPTION_TAGS = [
  { title: 'In progress', color: '#cfdffe' },
  { title: 'Blocked', color: '#ffdce5' },
  { title: 'Shipped', color: '#d1f7c4' },
  { title: 'Needs review', color: '#fee2d5' },
  { title: 'Backlog', color: '#ede2fe' },
]

const tags = ref([...OPTION_TAGS])

function removeTag(title: string) {
  tags.value = tags.value.filter((t) => t.title !== title)
}
</script>

<template>
  <PgSection id="badges" title="Badges & tags" source="NcBadge · NcBadgeBeta · NcBadgeComingSoon · NcSelectOptionTag">
    <PgDemo label="Colours" hint="with and without border">
      <div class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <NcBadge v-for="color in COLORS" :key="color" :color="color || undefined">
            <span class="text-captionSm px-1">{{ color || 'default' }}</span>
          </NcBadge>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <NcBadge v-for="color in COLORS" :key="color" :color="color || undefined" :border="false">
            <span class="text-captionSm px-1">{{ color || 'default' }}</span>
          </NcBadge>
        </div>
      </div>
    </PgDemo>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <PgDemo label="Sizes">
        <div class="flex flex-wrap items-center gap-2">
          <NcBadge v-for="size in SIZES" :key="size" color="brand" :size="size">
            <span class="text-captionSm px-1">size {{ size }}</span>
          </NcBadge>
        </div>
      </PgDemo>
      <PgDemo label="Rounded">
        <div class="flex flex-wrap items-center gap-2">
          <NcBadge v-for="r in ROUNDED" :key="r" color="purple" :rounded="r">
            <span class="text-captionSm px-1">rounded {{ r }}</span>
          </NcBadge>
        </div>
      </PgDemo>
      <PgDemo label="Preset badges">
        <div class="flex flex-wrap items-center gap-3">
          <NcBadgeBeta />
          <NcBadgeComingSoon />
          <div class="flex items-center gap-1 text-caption">Webhooks <NcBadgeBeta /></div>
        </div>
      </PgDemo>
      <PgDemo label="Select option tags" hint="click × to remove">
        <div class="flex flex-wrap items-center gap-2">
          <NcSelectOptionTag
            v-for="tag in tags"
            :key="tag.title"
            :title="tag.title"
            :color="tag.color"
            closable
            @close="removeTag(tag.title)"
          />
          <NcSelectOptionTag title="No colour code" color="#cfdffe" :is-color-code-enabled="false" />
          <NcButton v-if="tags.length < OPTION_TAGS.length" size="xxsmall" type="text" @click="tags = [...OPTION_TAGS]"
            >Reset</NcButton
          >
        </div>
      </PgDemo>
    </div>
  </PgSection>
</template>
