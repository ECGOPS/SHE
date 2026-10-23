/**
 * Phones (especially iPhone Safari) keep an old service worker for a long
 * time unless we ask for an update. When a new worker takes over, reload
 * once so the person sees the live build without clearing cache.
 */
export function checkForAppUpdate(): void {
  if (!('serviceWorker' in navigator)) return;

  const ask = () => {
    void navigator.serviceWorker.getRegistration().then((reg) => {
      void reg?.update();
    });
  };

  ask();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') ask();
  });
  window.addEventListener('focus', ask);
  window.addEventListener('online', ask);

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}
