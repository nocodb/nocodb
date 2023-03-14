<script lang="ts" setup>
import type { ProjectType } from 'nocodb-sdk'
import { useProjects } from '#imports'
import { extractSdkResponseErrorMsg } from '~/utils'
import {nextTick} from "@vue/runtime-core";

const props = defineProps<{
  project: ProjectType
}>()

const projectStore = useProjects()

const { updateProject } = projectStore

const editMode = ref(false)

const tempTitle = ref('')


const input =  ref<HTMLInputElement>()

const enableEditMode = () => {
  editMode.value = true
  tempTitle.value = props.project.title!
  nextTick(() => {
    input.value?.focus()
    input.value?.select()
  })
}

const updateProjectTitle = async () => {
  try {
    await updateProject(props.project.id!, {
      title: tempTitle.value,
    })
    editMode.value = false
    tempTitle.value = ''
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const closeEditMode = () => {
  editMode.value = false
  tempTitle.value = ''
}

onMounted(() => {
  if (editMode.value) {
    nextTick(() => {
      const input = document.querySelector('input') as HTMLInputElement
      input.focus()
      input.select()
    })
  }
})

</script>

<template>
  <div class="project-title-node group flex items-center">
    <input
      v-if="editMode"
      v-model="tempTitle"
      class="flex-grow min-w-5 leading-1 outline-0 ring-none"
      @click.stop
      @keyup.enter="updateProjectTitle"
      @keyup.esc="closeEditMode"
      ref="input"
    />
    <span v-else class="capitalize min-w-5 text-ellipsis overflow-clip">
      {{ project.title }}
    </span>
    <span :class="{ 'flex-grow': !editMode }"></span>
    <a-dropdown>
      <MdiDotsHorizontal class="mr-8 opacity-0 group-hover:opacity-100" @click.stop/>
      <template #overlay>
        <a-menu>
          <a-menu-item @click="enableEditMode">
            <div class="py-2">
              <MdiPencilOutline />
              Edit
            </div>
          </a-menu-item>
          <a-menu-item>
            <div class="py-2">
              <MdiDeleteOutline />
              Delete
            </div>
          </a-menu-item>
        </a-menu>
      </template>
    </a-dropdown>
  </div>
</template>

<style scoped></style>
