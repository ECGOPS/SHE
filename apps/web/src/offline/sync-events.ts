export const OFFLINE_QUEUE_EVENT = 'ecg-she-offline-sync';

export function notifyOfflineQueueChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(OFFLINE_QUEUE_EVENT));
}
