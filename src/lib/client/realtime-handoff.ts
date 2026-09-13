/**
 * Safe subscribe handoff: buffer realtime events until the HTTP snapshot is
 * applied, then drain and go live on the same subscription. Avoids the gap
 * from unsubscribe-buffer → subscribe-live, including when subscribe finishes
 * after the snapshot is already in hand.
 */
export function createEventHandoff<T>(apply: (event: T) => void) {
  let live = false;
  const buffer: T[] = [];

  function push(event: T) {
    if (live) apply(event);
    else buffer.push(event);
  }

  function release() {
    live = true;
    while (buffer.length > 0) {
      apply(buffer.shift() as T);
    }
  }

  return {
    push,
    release,
    get size() {
      return buffer.length;
    },
    get isLive() {
      return live;
    },
  };
}

/**
 * Hold events that arrive after the channel is attached but before the first
 * caller subscribe() — the subscribe-connects-after-snapshot case.
 */
export function createEarlySubscriber<T>() {
  const handlers = new Set<(event: T) => void>();
  const pending: T[] = [];

  function dispatch(event: T) {
    if (handlers.size === 0) {
      pending.push(event);
      return;
    }
    for (const handler of handlers) handler(event);
  }

  function subscribe(handler: (event: T) => void): () => void {
    handlers.add(handler);
    if (pending.length) {
      const queued = pending.splice(0);
      for (const event of queued) handler(event);
    }
    return () => {
      handlers.delete(handler);
    };
  }

  return { dispatch, subscribe };
}
