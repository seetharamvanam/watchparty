"use client";

import { Button } from "@/components/ui/button";
import {
  BROWSER_SETTINGS_HINT,
  hasDeniedMedia,
  permissionRecoveryCopy,
  type MediaDenied,
} from "@/lib/client/media-permissions";

export function PermissionRecovery({
  denied,
  onRetry,
  busy = false,
}: {
  denied: MediaDenied;
  onRetry: () => void;
  busy?: boolean;
}) {
  if (!hasDeniedMedia(denied)) return null;
  const copy = permissionRecoveryCopy(denied);

  return (
    <div
      role="status"
      data-permission-recovery="true"
      className="flex flex-col gap-2 border-t border-subtle bg-danger/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-danger">{copy.title}</p>
        <p className="mt-1 text-sm text-muted">{copy.body}</p>
        <p className="mt-1 text-xs text-muted">{BROWSER_SETTINGS_HINT}</p>
      </div>
      <Button size="sm" variant="secondary" onClick={onRetry} disabled={busy} aria-label={copy.retryLabel}>
        {busy ? "Retrying…" : copy.retryLabel}
      </Button>
    </div>
  );
}
