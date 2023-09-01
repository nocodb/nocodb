export default ({url}:{url:string}) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Redirecting...</title>
</head>
<body>
<script>
   window.location.href = '${url}'
</script>
</body>
</html>`
