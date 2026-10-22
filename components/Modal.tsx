"use client";

import { useEffect, useRef } from "react";

/** A simple dialog: closes with Esc, the close button, or a click outside. */
export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      // Esc closes the dialog natively. Ignore the close event React's dev double-mount causes while it is open again.
      onClose={() => {
        if (!ref.current?.open) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card">
        <div className="modal-head">
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="btn btn-small" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
