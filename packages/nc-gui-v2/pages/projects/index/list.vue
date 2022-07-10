<script lang="ts" setup>
import type { ProjectType } from 'nocodb-sdk'
import { navigateTo } from '#app'

interface Props {
  projects: ProjectType[]
}

const props = defineProps<Props>()
</script>

<template>
  <div>List view</div>
</template>
