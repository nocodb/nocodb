<script lang="ts" setup>
const supportedDocs = [
  {
    title: 'Permissions Overview',
    href: 'https://nocodb.com/docs/product-docs/roles-and-permissions',
  },
  {
    title: 'Setting up Table Permissions',
    href: 'https://nocodb.com/docs/product-docs/roles-and-permissions/table-permissions',
  },
  {
    title: 'Setting up Field Permissions',
    href: 'https://nocodb.com/docs/product-docs/roles-and-permissions/field-permissions',
  },
] as {
  title: string
  href: string
}[]
</script>

<template>
  <div class="w-full flex flex-col gap-3">
    <div class="text-sm text-nc-content-gray font-semibold">Support Docs</div>

    <div>
      <div v-for="(doc, idx) of supportedDocs" :key="idx" class="flex items-center gap-1">
        <div class="h-7 w-7 flex items-center justify-center">
          <GeneralIcon icon="bookOpen" class="flex-none w-4 h-4 text-nc-content-gray-subtle2" />
        </div>
        <a
          :href="doc.href"
          target="_blank"
          rel="noopener noreferrer"
          class="!text-nc-content-gray-subtle text-sm !no-underline !hover:underline"
        >
          {{ doc.title }}
        </a>
      </div>
    </div>
  </div>
</template>
