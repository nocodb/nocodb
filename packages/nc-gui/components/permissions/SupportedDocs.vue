<script lang="ts" setup>
const supportedDocs = [
  {
    title: 'Permissions Manager',
    href: 'https://docs.nocodb.com',
  },
  {
    title: 'Setting up Table Permissions',
    href: 'https://docs.nocodb.com',
  },
  {
    title: 'Setting up Field Permissions',
    href: 'https://docs.nocodb.com',
  },
] as {
  title: string
  href: string
}[]
</script>

<template>
  <div>
    <div class="w-full flex flex-col gap-3">
      <div class="text-sm text-gray-800 font-semibold">Support Docs</div>

      <div>
        <div v-for="(doc, idx) of supportedDocs" :key="idx" class="flex items-center gap-1">
          <div class="h-7 w-7 flex items-center justify-center">
            <GeneralIcon icon="bookOpen" class="flex-none w-4 h-4 text-gray-600" />
          </div>
          <a
            :href="doc.href"
            target="_blank"
            rel="noopener noreferrer"
            class="!text-gray-700 text-sm !no-underline !hover:underline"
          >
            {{ doc.title }}
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
