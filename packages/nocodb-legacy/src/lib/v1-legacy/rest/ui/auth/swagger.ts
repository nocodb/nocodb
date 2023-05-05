export default `<!DOCTYPE html>
<html>
<head>
    <title>API Docs</title>
    <link rel="shortcut icon" href="<%- ncPublicUrl %>/favicon.ico" />
    <link rel="stylesheet" href="<%- ncPublicUrl %>/css/swagger-ui-bundle.4.5.2.min.css"/>
    <script src="<%- ncPublicUrl %>/js/swagger-ui-bundle.4.5.2.min.js"></script>
</head>
<body>
<div id="app">
</div>

<script>
  const ui = SwaggerUIBundle({
    url: "<%- ncPublicUrl %>/nc/<%- projectId %>/<%- dbAlias %>/swagger.json",
    dom_id: '#app',
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIBundle.SwaggerUIStandalonePreset
    ],
  })
</script>
</body>
</html>
`;
