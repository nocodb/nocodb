import Tracker from '@openreplay/tracker';

// Export Tracker for global usage
if (typeof window !== 'undefined') {
  window.OpenReplay = Tracker;
}

// Also export as module
export default Tracker; 