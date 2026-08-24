"use client";

import { Modal } from "./Modal";
import { Button } from "./Button";

interface ConfirmProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function Confirm({
  open,
  title = "Are you sure?",
  message,
  confirmLabel = "Confirm",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} width="max-w-md">
      <p className="mb-6 text-sm text-body">{message}</p>
      <div className="flex justify-end gap-3">
        <Button variant="dark" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
