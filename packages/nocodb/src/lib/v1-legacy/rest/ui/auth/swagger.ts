export default `<!DOCTYPE html>
<html>
<head>
    <title>API Docs</title>
    <link rel="shortcut icon" href="/favicon.ico" />
    <link rel="stylesheet" href="/css/swagger-ui-bundle.4.5.2.min.css"/>
    <script src="/js/swagger-ui-bundle.4.5.2.min.js"></script>
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
