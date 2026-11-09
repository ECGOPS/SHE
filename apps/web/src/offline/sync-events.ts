export const OFFLINE_QUEUE_EVENT = 'ecg-she-offline-sync';

export interface OfflineQueueChange {
  /** How many queued reports were just delivered to the server. */
  sent: number;
}

export function notifyOfflineQueueChanged(change: OfflineQueueChange = { sent: 0 }): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<OfflineQueueChange>(OFFLINE_QUEUE_EVENT, { detail: change }));
}
