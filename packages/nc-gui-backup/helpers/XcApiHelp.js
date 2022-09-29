export function apiPrepareForInvocation(api) {
  api.meta.path = api.meta.path || api.path
  api.meta.method = api.meta.method.toUpperCase()
  api.meta.parameters = api.meta.parameters || (api.swagger.parameters && api.swagger.parameters.filter(p => p.in === 'query').map(p => ({
    name: p.name,
    value: '',
    enabled: false,
    description: p.description
  })))

  api.meta.headers = api.meta.headers || (api.swagger.parameters && api.swagger.parameters.filter(p => p.in === 'header').map(p => ({
    name: p.name,
    value: '',
    enabled: false,
    description: p.description
  })))

  return api
}

export function nodeHandleIfNew(node) {
  if (node.isLeaf && !node.meta) {
    node.swagger = {
      parameters: []
    }
    node.meta = {
      method: 'GET',
      parameters: [],
      headers: [],
      path: ''
    }
  } else if (!node.meta) {
    node.meta = {}
    node.swagger = {}
  }
}

export function axiosRequestMake(apiMeta) {
  if (apiMeta.body) {
    try {
      apiMeta.body = JSON.parse(apiMeta.body)
    } catch (e) {
      console.log(e)
    }
  }

  if (apiMeta.auth) {
    try {
      apiMeta.auth = JSON.parse(apiMeta.auth)
    } catch (e) {
      console.log(e)
    }
  }

  apiMeta.response = {}
  const req = {
    params: apiMeta.parameters
      ? apiMeta.parameters.reduce((paramsObj, param) => {
        if (param.name && param.enabled) { paramsObj[param.name] = param.value }
        return paramsObj
      }, {})
      : {},
    url: apiMeta.path,
    method: apiMeta.method,
    data: apiMeta.body,
    headers: apiMeta.headers
      ? apiMeta.headers.reduce((headersObj, header) => {
        if (header.name && header.enabled) { headersObj[header.name] = header.value }
        return headersObj
      }, {})
      : {},
    withCredentials: true
  }
  return req
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
