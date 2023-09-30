import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';

let push;

const clickListener = (e) => {
  if(e.nc_handled) return
  e.nc_handled = true
  let target = e.target;

  while (target && !target['classList'].contains('DocSearch-Hit')) {
    target = target['parentElement'];
  }
  if (target) {
    const searchInput = document.querySelector('.DocSearch-Input')
    push({
      event: 'search',
      $current_url: location.pathname,
      hash: location.hash,
      item_clicked: target.innerText.trim(),
      search_query: searchInput && searchInput.value
    });
  }
}

if (ExecutionEnvironment.canUseDOM) {
  const { init, push: _push } = require('nc-analytics');
  push = _push;
  init();

  document.body.removeEventListener('click', clickListener, true);
  document.body.addEventListener('click', clickListener, true);
}

export function onRouteDidUpdate({ location, previousLocation }) {
  // Don't execute if we are still on the same page; the lifecycle may be fired
  // because the hash changes (e.g. when navigating between headings)
  if (location.pathname !== previousLocation?.pathname || location.hash !== previousLocation?.hash) {
    push({
      event: '$pageview',
      $current_url: location.pathname,
      hash: location.hash,
    });
  }
}


