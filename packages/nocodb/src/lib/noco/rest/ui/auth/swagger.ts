export default `<!DOCTYPE html>
<html>
<head>
    <title>XC Swagger UI</title>

    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/3.47.1/swagger-ui.min.css" integrity="sha512-aEbfSpriGJ1mxZoWXLSwbJ8GSMLVNXBmHidn2cAGFHfJCFKSuqZEVzJy3ULeFRvvBIo7AHQbhkPIJ6sKW00GWQ==" crossorigin="anonymous" referrerpolicy="no-referrer" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, minimal-ui">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/3.47.1/swagger-ui-bundle.js" integrity="sha512-jgRW0JF86OgfePQNihFG6r/1FX3X/ZHZ3eqKt2iu2dbog4m0XjnZNvhiuLgN1ttXQnpP0fjLOPf7M1Y9kpEPWQ==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>

</head>
<body>
<div id="app">
</div>

<script>
  const ui = SwaggerUIBundle({
    url: "/nc/<%- projectId %>/<%- dbAlias %>/swagger.json",
    dom_id: '#app',
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIBundle.SwaggerUIStandalonePreset
    ],
  })
</script>
</body>
</html>
`/**
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
