import express from 'express';
import path from 'path';

const pageContent = `<!DOCTYPE html>
<html>
<head>
    <title>NocoDB API Documentation</title>
    <!-- needed for adaptive design -->
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
    <!--
    Redoc doesn't change outer page styles
    -->
    <style>
        body {
            margin: 0;
            padding: 0;
        }
    </style>
</head>
<body>
<img src="https://static.scarf.sh/a.png?x-pxid=c12a77cc-855e-4602-8a0f-614b2d0da56a"/>
<redoc spec-url='./swagger.json'></redoc>
<script src="https://cdn.jsdelivr.net/npm/redoc@latest/bundles/redoc.standalone.js"></script>
</script>
</body>
</html>`;

const app = express();

app.get('/', function (_req, res) {
  res.send(pageContent);
});

app.use(
  '/swagger.json',
  express.static(path.join(__dirname, '../schema/swagger.json'))
);

app.listen(3001, function () {
  console.log(
    'Example app listening on port 3001! Go to http://localhost:3001'
  );
});
