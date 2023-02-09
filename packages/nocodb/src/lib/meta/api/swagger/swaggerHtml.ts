export default ({
  ncSiteUrl,
}: {
  ncSiteUrl: string;
}): string => `<!DOCTYPE html>
<html>
<head>
    <title>NocoDB : API Docs</title>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, minimal-ui">
    <link rel="shortcut icon" href="${ncSiteUrl}/favicon.ico" />
    <link rel="stylesheet" href="${ncSiteUrl}/css/swagger-ui-bundle.4.5.2.min.css"/>
    <script src="${ncSiteUrl}/js/swagger-ui-bundle.4.5.2.min.js"></script>
</head>
<body>
<div id="app"></div>
<script>

let initialLocalStorage = {}

try {
  initialLocalStorage = JSON.parse(localStorage.getItem('nocodb-gui-v2') || '{}');
} catch (e) {
  console.error('Failed to parse local storage', e);
}

var xmlhttp = new XMLHttpRequest();   // new HttpRequest instance 
xmlhttp.open("GET", "./swagger.json");
xmlhttp.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
xmlhttp.setRequestHeader("xc-auth", initialLocalStorage && initialLocalStorage.token);
xmlhttp.onload = function () {

  const ui = SwaggerUIBundle({
    // url: ,
    spec: JSON.parse(xmlhttp.responseText),
    dom_id: '#app',
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIBundle.SwaggerUIStandalonePreset
    ],
  })
}
xmlhttp.send();

  
  console.log('%c🚀 We are Hiring!!! 🚀%c\\n%cJoin the forces http://careers.nocodb.com', 'color:#1348ba;font-size:3rem;padding:20px;', 'display:none', 'font-size:1.5rem;padding:20px');
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
</html>
`;
