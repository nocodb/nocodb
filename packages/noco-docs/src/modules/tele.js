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
      event: 'docs/search',
      $current_url: location.href,
      path: location.pathname,
      hash: location.hash,
      item_clicked: (target.innerText || '').trim(),
      search_query: searchInput && searchInput.value
    });
  }
}

const keydownListener = (e) => {
  if(e.nc_handled || e.which !== 13) return
  e.nc_handled = true
  let target = e.target;



  while (target && !target['classList'].contains('DocSearch-Input')) {
    target = target['parentElement'];
  }

  if (target) {
    const selectedElement = document.querySelector('.DocSearch-Hit[aria-selected=true] a')

    if(selectedElement) {
      push({
        event: 'docs/search',
        $current_url: location.href,
        path: location.pathname,
        hash: location.hash,
        item_clicked: (selectedElement.innerText || '').trim(),
        search_query: target && target.value
      });
    }
  }
}

if (ExecutionEnvironment.canUseDOM) {
  const { init, push: _push } = require('nc-analytics');
  push = _push;
  init();

  document.body.removeEventListener('click', clickListener, true);
  document.body.removeEventListener('keydown', keydownListener, true);
  document.body.addEventListener('click', clickListener, true);
  document.body.addEventListener('keydown', keydownListener, true);

  const  url = new URL(location.href);

  const origin = url.searchParams.get('origin');
  const search = url.searchParams.get('search');

  if(origin && search) {
    push({
      event: 'cloud/search',
      $current_url: location.href,
      path: location.pathname,
      hash: location.hash,
      search_query: search,
      origin
    });
    url.searchParams.delete('origin');
    url.searchParams.delete('search');
    window.history.replaceState({}, document.title, url.toString());
  }
}

export function onRouteDidUpdate({ location, previousLocation }) {
  // Don't execute if we are still on the same page; the lifecycle may be fired
  // because the hash changes (e.g. when navigating between headings)
  if (location.pathname !== previousLocation?.pathname || location.hash !== previousLocation?.hash) {
    console.log(location.href)

    push({
      event: '$pageview',
      $current_url: window.location.href,
      path: location.pathname,
      hash: location.hash,
    });
  }
}
