<script setup lang="ts">
import PgDemo from '../../-components/PgDemo.vue'
import PgSection from '../../-components/PgSection.vue'

const SWITCH_SIZES = ['default', 'small', 'xsmall', 'xxsmall'] as const

const CHECKBOX_SIZES = ['small', 'default', 'large'] as const

const notifications = ref(true)

const weeklyDigest = ref(false)

const permissions = reactive({ read: true, write: true, delete: false })

const allChecked = computed(() => permissions.read && permissions.write && permissions.delete)

const someChecked = computed(() => !allChecked.value && (permissions.read || permissions.write || permissions.delete))

const role = ref('editor')

function toggleAll(value: boolean) {
  permissions.read = value
  permissions.write = value
  permissions.delete = value
}
</script>

<template>
  <PgSection id="toggles" title="Switches, checkboxes & radios" source="NcSwitch · NcCheckbox · a-radio-group">
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <PgDemo label="NcSwitch" hint="sizes · placement · states">
        <div class="flex flex-col gap-3">
          <div v-for="size in SWITCH_SIZES" :key="size" class="flex items-center gap-4">
            <span class="w-16 text-captionXs text-nc-content-gray-muted font-mono">{{ size }}</span>
            <NcSwitch v-model:checked="notifications" :size="size" />
            <NcSwitch :checked="false" :size="size" />
            <NcSwitch :checked="true" :size="size" disabled />
            <NcSwitch :checked="true" :size="size" loading />
          </div>
          <!-- NcSwitch is a fragment (switch + label span): give each its own block div, as the product does -->
          <div class="flex flex-col gap-3 pt-3 border-t-1 border-nc-border-gray-light">
            <div>
              <NcSwitch v-model:checked="notifications">
                <span class="text-caption text-nc-content-gray select-none">Email notifications</span>
              </NcSwitch>
            </div>
            <div>
              <NcSwitch v-model:checked="weeklyDigest" placement="right">
                <span class="text-caption text-nc-content-gray select-none">Weekly digest (label left)</span>
              </NcSwitch>
            </div>
            <div>
              <NcSwitch :checked="false" disabled>
                <span class="text-caption text-nc-content-gray select-none">Disabled with label</span>
              </NcSwitch>
            </div>
          </div>
        </div>
      </PgDemo>

      <PgDemo label="NcCheckbox" hint="sizes · indeterminate · themes">
        <div class="flex flex-col gap-3">
          <div v-for="size in CHECKBOX_SIZES" :key="size" class="flex items-center gap-4">
            <span class="w-16 text-captionXs text-nc-content-gray-muted font-mono">{{ size }}</span>
            <NcCheckbox :checked="true" :size="size" />
            <NcCheckbox :checked="false" :size="size" />
            <NcCheckbox :checked="false" indeterminate :size="size" />
            <NcCheckbox :checked="true" disabled :size="size" />
            <NcCheckbox :checked="true" theme="ai" :size="size" />
            <NcCheckbox :checked="true" readonly :size="size" />
          </div>
          <div class="flex flex-col gap-2 pt-2 border-t-1 border-nc-border-gray-light">
            <NcCheckbox :checked="allChecked" :indeterminate="someChecked" @update:checked="toggleAll"
              >All permissions</NcCheckbox
            >
            <!-- one block each: ant indents adjacent checkbox wrappers by 8px -->
            <div class="pl-6 flex flex-col gap-2">
              <div><NcCheckbox v-model:checked="permissions.read">Read records</NcCheckbox></div>
              <div><NcCheckbox v-model:checked="permissions.write">Edit records</NcCheckbox></div>
              <div><NcCheckbox v-model:checked="permissions.delete">Delete records</NcCheckbox></div>
            </div>
          </div>
        </div>
      </PgDemo>

      <PgDemo label="Radio group" hint="a-radio-group">
        <a-radio-group v-model:value="role" class="!flex flex-col gap-2">
          <a-radio value="owner">Owner</a-radio>
          <a-radio value="editor">Editor</a-radio>
          <a-radio value="viewer">Viewer</a-radio>
          <a-radio value="guest" disabled>Guest (disabled)</a-radio>
        </a-radio-group>
      </PgDemo>
    </div>
  </PgSection>
</template>
