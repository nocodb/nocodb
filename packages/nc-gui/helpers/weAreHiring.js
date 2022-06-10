export default function weAreHiring() {
  const fn = () => {
    console.log('%c🚀 We are Hiring!!! 🚀%c\n%cJoin the forces http://careers.nocodb.com', 'color:#1348ba;font-size:3rem;padding:20px;', 'display:none', 'font-size:1.5rem;padding:20px')
  }
  fn()
  setInterval(fn, 300000)
}
