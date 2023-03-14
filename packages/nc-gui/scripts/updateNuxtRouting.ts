/** A temporary solution to enable hash based routing until
 * nuxt-team merges - https://github.com/nuxt/framework/pull/6980
 */
import fs from 'node:fs'
import path from 'node:path'

const filePath = path.join(__dirname, '..', 'node_modules', 'nuxt', 'dist', 'pages', 'runtime', 'router.mjs')

/** Read file content to be updated */
const content = fs.readFileSync(filePath, 'utf8')

/** Replace `createWebHistory` with `createWebHashHistory` */
const updatedContent = content
  .replace(
    /createRouter(\s*,\s*)createWebHistory(\s*,\s*)createMemoryHistory/,
    `createRouter$1createWebHashHistory as createWebHistory$2createMemoryHistory`,
  )
  /** Replace initial Handle initial routing based on hash path */
  .replace(
    `const { pathname, search, hash } = location;`,
    `const { pathname, search, hash } = new URL((location.hash || '').replace(/^#/, ''), location.origin);`,
  )

/** Update file content with updated code */
fs.writeFileSync(filePath, updatedContent, 'utf8')
