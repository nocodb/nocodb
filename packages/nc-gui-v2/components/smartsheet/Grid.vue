<template>
  <div>

    <div class="card">
      <DataTable :value="rows" responsiveLayout="scroll">

        <Column v-for="col in meta.columns" :key="col.id" :field="col.title" :header="col.title">
          <template v-if="col.uidt === 'LinkToAnotherRecord'" #body="{data:{[col.title]:d}}">
            {{ d&& (Array.isArray(d) ? d : [d]).map(c1 => c1[Object.keys(c1)[1]]).join(', ') }}
          </template>
        </Column>
      </DataTable>
    </div>

  </div>
</template>

<script lang="ts" setup>
import {useNuxtApp} from "#app";
import {Api} from "nocodb-sdk";
import {useUser} from "~/composables/user";

const {tabMeta, meta} = defineProps({
  tabMeta: Object,
  meta: Object
})

const {project} = useProject()
const {user} = useUser()
const rows = ref()

const {$api}: { $api: Api<any> } = useNuxtApp() as any


const loadData = async () => {
  const response = await $api.dbTableRow.list('noco',
      project.value.id,
      meta.id, {}, {
        headers: {
          'xc-auth': user.token
        }
      })

  rows.value = response.list
}

onMounted(async () => {
  await loadData()
})


</script>

<style scoped>

</style>
