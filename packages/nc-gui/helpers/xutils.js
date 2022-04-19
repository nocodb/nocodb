export default function isDev() {
  return process.env.NODE_ENV &&
    (process.env.NODE_ENV.toLowerCase() === 'development' || process.env.NODE_ENV.toLowerCase() === 'dev')
}

export function isMetaTable(table_name) {
  return [
    '_evolutions',
    'nc_models',
    'nc_routes',
    'nc_hooks',
    'nc_store',
    'nc_evolutions',
    'nc_migrations',
    'nc_users',
    'nc_rpc',
    'nc_loaders',
    'nc_resolvers',
    'nc_roles',
    'nc_cron',
    'nc_acl',
    'nc_api_tokens',
    'nc_projects',
    'nc_projects_users',
    'nc_relations',
    'nc_shared_views',
    'nc_audit',
    'nc_knex_migrations',
    'nc_knex_migrations_lock',
    'xc_knex_migrations',
    'xc_knex_migrations_lock',
    'xc_users',
    'nc_plugins',
    'nc_disabled_models_for_role'
  ].includes(table_name)
}

export function insertKey(key, value, obj, pos) {
  const keys = Object.keys(obj)
  if (!keys.length || pos > keys.length - 1) {
    obj[key] = value
    return obj
  }
  return keys.reduce((ac, a, i) => {
    if (i === pos) { ac[key] = value }
    ac[a] = obj[a]
    return ac
  }, {})
}

export function copyTextToClipboard(text) {
  const textArea = document.createElement('textarea')

  //
  // *** This styling is an extra step which is likely not required. ***
  //
  // Why is it here? To ensure:
  // 1. the element is able to have focus and selection.
  // 2. if element was to flash render it has minimal visual impact.
  // 3. less flakyness with selection and copying which **might** occur if
  //    the textarea element is not visible.
  //
  // The likelihood is the element won't even render, not even a
  // flash, so some of these are just precautions. However in
  // Internet Explorer the element is visible whilst the popup
  // box asking the user for permission for the web page to
  // copy to the clipboard.
  //

  // Place in top-left corner of screen regardless of scroll position.
  textArea.style.position = 'fixed'
  textArea.style.top = 0
  textArea.style.left = 0

  // Ensure it has a small width and height. Setting to 1px / 1em
  // doesn't work as this gives a negative w/h on some browsers.
  textArea.style.width = '2em'
  textArea.style.height = '2em'

  // We don't need padding, reducing the size if it does flash render.
  textArea.style.padding = 0

  // Clean up any borders.
  textArea.style.border = 'none'
  textArea.style.outline = 'none'
  textArea.style.boxShadow = 'none'

  // Avoid flash of white box if rendered for any reason.
  textArea.style.background = 'transparent'

  textArea.addEventListener('focusin', e => e.stopPropagation())

  textArea.value = text

  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()

  try {
    const successful = document.execCommand('copy')
    const msg = successful ? 'successful' : 'unsuccessful'
  } catch (err) {
    console.log('Oops, unable to copy')
  }

  document.body.removeChild(textArea)
}

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
