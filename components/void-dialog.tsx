"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  onConfirm: () => Promise<void>;
  disabled?: boolean;
};

export function VoidDialog({ onConfirm, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setErr(null);
    try {
      await onConfirm();
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Void failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="danger"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Void bill
      </Button>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center p-4 z-50"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 max-w-sm w-full flex flex-col gap-4">
            <h2 className="font-semibold text-lg">Void this bill?</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Stock will be restored. This cannot be undone.
            </p>
            {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={confirm} disabled={busy}>
                {busy ? "Voiding..." : "Confirm void"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
