"use client";

import { useEffect, useState } from "react";
import CopyButton from "./CopyButton";
import { useApp } from "./AppProvider";
import { qrDataUrl, qrPoster } from "@/lib/qr-poster";

/** The restaurant's public feedback page: link, QR code to print, preview and Google review link. */
export default function CustomerPageCard() {
  const { restaurant, saveSettings, settings, toast } = useApp();
  const [google, setGoogle] = useState(restaurant?.googleReviewUrl ?? "");
  const [qr, setQr] = useState("");
  const [saving, setSaving] = useState(false);
  const slug = restaurant?.slug ?? "";
  const url = `${typeof window === "undefined" ? "" : window.location.origin}/r/${slug}`;

  useEffect(() => {
    let cancelled = false;
    if (slug) void qrDataUrl(url, 360).then((d) => !cancelled && setQr(d));
    return () => {
      cancelled = true;
    };
  }, [slug, url]);

  if (!restaurant || !settings) return null;
  const googleOk = !google.trim() || /^https?:\/\//i.test(google.trim());
  const changed = google.trim() !== restaurant.googleReviewUrl;

  async function download() {
    try {
      const href = await qrPoster(url, restaurant!.name);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${restaurant!.slug}-feedback-qr.png`;
      a.click();
    } catch {
      toast("Couldn't make the QR poster. Try again.", "error");
    }
  }

  return (
    <section className="panel customer-card">
      <h2>Your customer page</h2>
      <p className="muted small">
        Guests scan a QR code at the table or on the bill and tell you how their visit was. Low ratings reach only you. Guests who rate 4 or
        5 are invited to share on Google.
      </p>
      <div className="customer-grid">
        <div className="qr-box">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr ? <img src={qr} alt={`QR code for ${restaurant.name}'s feedback page`} width={180} height={180} /> : <div className="qr-placeholder" />}
        </div>
        <div className="customer-actions">
          <label className="field">
            Your page link
            <input type="text" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
          </label>
          <div className="actions">
            <CopyButton text={url} label="Copy link" />
            <button type="button" className="btn btn-solid btn-small" onClick={download}>
              Download QR to print
            </button>
            <a className="btn btn-small" href={`/r/${slug}`} target="_blank" rel="noopener noreferrer">
              Preview the page
            </a>
          </div>
        </div>
      </div>
      <label className="field">
        Google review link (optional)
        <input
          type="url"
          value={google}
          placeholder="e.g. https://g.page/r/your-restaurant/review"
          onChange={(e) => setGoogle(e.target.value)}
        />
        <span className="field-help">
          Where happy guests are sent. In Google Business Profile, choose &ldquo;Ask for reviews&rdquo; and copy the link. If you leave it
          empty, the button opens your restaurant on Google Maps.
        </span>
      </label>
      {!googleOk && <p className="notice notice-warning">The link should start with https://</p>}
      <div className="actions">
        <button
          type="button"
          className="btn btn-small"
          disabled={!googleOk || !changed || saving}
          onClick={async () => {
            setSaving(true);
            const ok = await saveSettings(settings, google);
            setSaving(false);
            toast(ok ? "Google link saved" : "Couldn't save the link. Try again.", ok ? "success" : "error");
          }}
        >
          Save Google link
        </button>
      </div>
      <p className="muted small">The page address stays the same even if you rename the restaurant.</p>
    </section>
  );
}
