"use client";

import { useState } from "react";
import { useApp } from "./AppProvider";

export default function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const { toast } = useApp();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast("Copied to clipboard", "success");
    } catch {
      setCopied(false);
      toast("Couldn't copy. Select the text and copy it yourself.", "error");
    }
  }

  return (
    <button type="button" className="btn" onClick={copy} disabled={!text.trim()}>
      {copied ? "Copied" : label}
    </button>
  );
}
