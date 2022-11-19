export default `<!DOCTYPE html>
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
<div id="redoc"></div>
<script src="https://cdn.jsdelivr.net/npm/redoc@latest/bundles/redoc.standalone.js"></script>
<script>
  let initialLocalStorage = {}
  
  try {
    initialLocalStorage = JSON.parse(localStorage.getItem('nocodb-gui-v2') || '{}');
  } catch (e) {
    console.error('Failed to parse local storage', e);
  }

  const xhttp = new XMLHttpRequest();
  
  xhttp.open("GET", "./swagger.json");
  xhttp.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
  xhttp.setRequestHeader("xc-auth", initialLocalStorage && initialLocalStorage.token);

  xhttp.onload = function () {
      const swaggerJson = this.responseText;
      const swagger = JSON.parse(swaggerJson);
      Redoc.init(swagger, {
        scrollYOffset: 50
      }, document.getElementById('redoc'))
  };
  
  xhttp.send();
</script>
<script>
 console.log('%c🚀 We are Hiring!!! 🚀%c\\n%cJoin the forces http://careers.nocodb.com', 'color:#1348ba;font-size:3rem;padding:20px;', 'display:none', 'font-size:1.5rem;padding:20px')
   const linkEl = document.createElement('a')
  linkEl.setAttribute('href', "http://careers.nocodb.com")
  linkEl.setAttribute('target', '_blank')
  linkEl.setAttribute('class', 'we-are-hiring')
  linkEl.innerHTML = '🚀 We are Hiring!!! 🚀'
  const styleEl = document.createElement('style');
  styleEl.innerHTML = \`
.we-are-hiring {
  position: fixed;
  bottom: 50px;
  right: -250px;
  opacity: 0;
  background: orange;
  border-radius: 4px;
  padding: 19px;
  z-index: 200;
  text-decoration: none; 
  text-transform: uppercase;
  color: black;
  transition: 1s opacity, 1s right;
  display: block;
  font-weight: bold;
}        

.we-are-hiring.active {
  opacity: 1;
  right:25px;
}

@media only screen and (max-width: 600px) {
  .we-are-hiring {
    display: none;
  }
}
        \`
  document.body.appendChild(linkEl, document.body.firstChild)
  document.body.appendChild(styleEl, document.body.firstChild)
  setTimeout(() => linkEl.classList.add('active'), 2000)
</script>
</body>
</html>`
