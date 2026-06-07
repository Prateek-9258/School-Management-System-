export function register(config) {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`${process.env.PUBLIC_URL}/service-worker.js`)
        .then(r => {
          console.log('SW registered:', r.scope);
          r.onupdatefound = () => {
            const i = r.installing;
            if (!i) return;
            i.onstatechange = () => {
              if (i.state === 'installed' && navigator.serviceWorker.controller && config?.onUpdate) {
                config.onUpdate(r);
              }
            };
          };
        });
    });
  }
}
export function unregister() {
  if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then(r => r.unregister());
}