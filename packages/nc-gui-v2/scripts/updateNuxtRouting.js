/** A temporary solution to enable hash based routing until
 * nuxt-team merges - https://github.com/nuxt/framework/pull/6980
 */

const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, '..', 'node_modules', 'nuxt', 'dist', 'pages', 'runtime', 'router.mjs')

/** Read file content to be updated */
const content = fs.readFileSync(filePath, 'utf8')

/** Replace `createWebHistory` with `createWebHashHistory` */
const updatedContent = content.replace(
  /createWebHistory(\s*,\s*)createMemoryHistory/,
  `createWebHashHistory as createWebHistory$1createMemoryHistory`,
)

/** Update file content with updated code */
fs.writeFileSync(filePath, updatedContent, 'utf8')
