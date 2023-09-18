import { init, push } from 'nc-analytics';

init();

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

