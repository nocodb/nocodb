export default function isDev() {
  return process.env.NODE_ENV &&
    (process.env.NODE_ENV.toLowerCase() === 'development' || process.env.NODE_ENV.toLowerCase() === 'dev')
}

export function isMetaTable(tableName) {
  return [
    '_evolutions',
    'nc_evolutions',
    'nc_acl',
    'nc_api_tokens',
    'nc_audit',
    'nc_audit_v2',
    'nc_bases_v2',
    'nc_col_formula_v2',
    'nc_col_lookup_v2',
    'nc_col_relations_v2',
    'nc_col_rollup_v2',
    'nc_col_select_options_v2',
    'nc_columns_v2',
    'nc_cron',
    'nc_disabled_models_for_role',
    'nc_disabled_models_for_role_v2',
    'nc_filter_exp_v2',
    'nc_form_view_columns_v2',
    'nc_form_view_v2',
    'nc_gallery_view_columns_v2',
    'nc_gallery_view_v2',
    'nc_grid_view_columns_v2',
    'nc_grid_view_v2',
    'nc_hook_logs_v2',
    'nc_hooks',
    'nc_hooks_v2',
    'nc_kanban_view_columns_v2',
    'nc_kanban_view_v2',
    'nc_loaders',
    'nc_migrations',
    'nc_models',
    'nc_models_v2',
    'nc_orgs_v2',
    'nc_plugins',
    'nc_plugins_v2',
    'nc_project_users_v2',
    'nc_projects',
    'nc_projects_users',
    'nc_projects_v2',
    'nc_relations',
    'nc_resolvers',
    'nc_roles',
    'nc_routes',
    'nc_rpc',
    'nc_shared_bases',
    'nc_shared_views',
    'nc_shared_views_v2',
    'nc_sort_v2',
    'nc_store',
    'nc_team_users_v2',
    'nc_teams_v2',
    'nc_users_v2',
    'nc_views_v2',
    'xc_knex_migrations',
    'xc_knex_migrations_lock',
    'xc_knex_migrationsv2',
    'xc_knex_migrationsv2_lock'
  ].includes(tableName)
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

export function toSafeString(value) {
  return typeof value === 'object' ? JSON.stringify(value) : value;
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
 * @author Wing-Kam Wong <wingkwong.code@gmail.com>
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
