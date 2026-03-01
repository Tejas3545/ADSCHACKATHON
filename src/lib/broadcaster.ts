/**
 * In-process SSE broadcaster.
 * When data changes (webhook push, manual admin action, submission),
 * call broadcast() and every connected browser tab gets the event instantly.
 */

type Listener = (payload: string) => void;

const listeners = new Set<Listener>();

export function subscribe(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function broadcast(event: string, data: Record<string, unknown> = {}) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const fn of listeners) {
    try {
      fn(msg);
    } catch {
      listeners.delete(fn);
    }
  }
}
