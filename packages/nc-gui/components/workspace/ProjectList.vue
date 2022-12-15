<template>
  <div>
  <table class="nc-project-list-table">
    <thead>
    <tr>
      <th>Project Name</th>
      <th>Project Type</th>
      <th>Last Modified</th>
      <th>My Role</th>
      <th>Actions</th>
    </tr>
    </thead>
    <tbody>
    <tr v-for="(project, i) of projects" :key="i">
      <td class="!py-0">
        <div class="flex items-center nc-project-title gap-2">
          <span class="color-band" :style="{ backgroundColor: stringToColour(project.title) }" />
          {{ project.title }}
        </div>
      </td>
      <td>
        <div class="flex items-center gap-2">
          <MaterialSymbolsDocs class="text-gray-500" v-if="project.types?.includes(ProjectType.DOCS)" />
          <MdiTransitConnectionVariant class="text-gray-500" v-if="project.types?.includes(ProjectType.AUTOMATION)" />
          <MdiDatabaseOutline class="text-gray-500" v-if="project.types?.includes(ProjectType.DB)" />
        </div>
      </td>
      <td>{{ (i + 3) % 20 }} hours ago</td>
      <td>
        {{ project.role }}
      </td>
      <td>
        <MdiDotsHorizontal class="!text-gray-400 nc-workspace-menu" />
      </td>
    </tr>
    </tbody>
  </table>
  </div>
</template>

<script lang="ts" setup>


enum ProjectType {
  DOCS,
  DB,
  AUTOMATION,
}

// todo: load using api
const workspaces = $ref([
  {
    title: 'Noco 1',
    description: 'Description 1',
  },
  {
    title: 'Workspace 2',
    description: 'Description 1',
  },
  {
    title: 'Test 3',
    description: 'Description 1',
  },
  {
    title: 'Test work 4',
    description: 'Description 1',
  },
  {
    title: 'ABC 5',
    description: 'Description 1',
  },
  {
    title: 'Recent',
    description: 'Description 1',
  },
  {
    title: 'Favourites',
    description: 'Description 1',
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
    types: [ProjectType.DB, ProjectType.DOCS],
  },
  {
    title: 'Workspace 2',
    description: 'Description 1',
    role: 'Viewer',
    types: [ProjectType.AUTOMATION],
  },
  {
    title: 'Test 3',
    description: 'Description 1',
    role: 'Admin',
    types: [ProjectType.DB, ProjectType.AUTOMATION, ProjectType.DOCS],
  },
  {
    title: 'Test work 4',
    description: 'Description 1',
    role: 'Viewer',
    types: [ProjectType.DB, ProjectType.DOCS],
  },
  {
    title: 'ABC 5',
    description: 'Description 1',
    role: 'Editor',
    types: [ProjectType.DOCS],
  },
  {
    title: 'Recent',
    description: 'Description 1',
    role: 'Admin',
    types: [ProjectType.DB],
  },
  {
    title: 'Favourites',
    description: 'Description 1',
    role: 'Editor',
    types: [ProjectType.DOCS, ProjectType.DB],
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
    @apply w-6 h-6 left-0 top-[10px] rounded-md;
  }
}
</style>
