<template>
  <div>
    <table class="nc-project-list-table">
      <thead>
      <tr>
        <th>Name</th>
        <th>Last Modified</th>
        <th>My Role</th>
        <th>Actions</th>
      </tr>
      </thead>
      <tbody>
      <tr v-for="(collab, i) of collaborators" :key="i">
        <td class="!py-0">
          <div class="flex items-center nc-project-title gap-2">
            <span class="color-band"
                  :style="{ backgroundColor: stringToColour(collab.title) }">{{ collab.title.slice(0, 2) }}</span>
            {{ collab.title }}
          </div>
        </td>
        <td>{{ (i + 3) % 20 }} hours ago</td>
        <td>
          {{ collab.role }}
        </td>
        <td>
          <MdiDotsHorizontal class="!text-gray-400 nc-workspace-menu"/>
        </td>
      </tr>
      </tbody>
    </table>
  </div>
</template>

<script lang="ts" setup>


// todo: load using api
const collaborators = $ref([
  {
    title: 'Sam',
    role: 'Viewer',
  },
  {
    title: 'John',
    role: 'Admin',
  },
  {
    title: 'Alex',
    role: 'Viewer',
  },
  {
    title: 'Samuel',
    role: 'Editor',
  },
  {
    title: 'George',
    role: 'Admin',
  },
])

// todo: make it customizable
const stringToColour = function (str: string) {
  let i
  let hash = 0
  for (i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  let colour = '#'
  for (i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff
    colour += `00${value.toString(16)}`.substr(-2)
  }
  return colour
}
// todo: load using api
const projects = $ref([
  {
    title: 'Noco 1',
    description: 'Description 1',
    role: 'Admin',
  },
  {
    title: 'Workspace 2',
    description: 'Description 1',
    role: 'Viewer',
  },
  {
    title: 'Test 3',
    description: 'Description 1',
    role: 'Admin',
  },
  {
    title: 'Test work 4',
    description: 'Description 1',
    role: 'Viewer',
  },
  {
    title: 'ABC 5',
    description: 'Description 1',
    role: 'Editor',
  },
  {
    title: 'Recent',
    description: 'Description 1',
    role: 'Admin',
  },
  {
    title: 'Favourites',
    description: 'Description 1',
    role: 'Editor',
  },
])
</script>

<style scoped lang="scss">

.nc-project-list-table {
  @apply min-w-[700px] !w-full;

  th {
    @apply .font-normal !text-gray-400 pb-4;
    border-bottom: 1px solid #e3e3e3;
  }

  td {
    @apply .font-normal pb-4;
    border-bottom: 1px solid #f5f5f5;
  }

  th,
  td {
    @apply text-left p-4;
  }

  th:first-child,
  td:first-child {
    @apply pl-6;
  }

  th:last-child,
  td:last-child {
    @apply pr-6;
  }
}


.nc-project-title {
  .color-band {
    @apply w-6 h-6 left-0 top-[10px] rounded-full flex justify-center uppercase text-white font-weight-bold text-xs items-center;
  }
}
</style>
