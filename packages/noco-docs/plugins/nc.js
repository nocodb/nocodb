console.log('%c🚀 We are Hiring!!! 🚀%c\n%cJoin the forces http://careers.nocodb.com', 'color:#1348ba;font-size:3rem;padding:20px;', 'display:none', 'font-size:1.5rem;padding:20px')

export default () => {
  const linkEl = document.createElement('a')
  linkEl.setAttribute('href', "http://careers.nocodb.com")
  linkEl.setAttribute('target', '_blank')
  linkEl.setAttribute('class', 'we-are-hiring')
  linkEl.innerHTML = '🚀 We are Hiring!!! 🚀'
  const styleEl = document.createElement('style');
  styleEl.innerHTML = `
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
        `
  document.body.appendChild(linkEl, document.body.firstChild)
  document.body.appendChild(styleEl, document.body.firstChild)
  setTimeout(() => linkEl.classList.add('active'), 2000)

}
