"use client";

import { WEEKDAYS, type DaySettings, type RestaurantSettings, type Section, type Weekday } from "@/lib/settings";

interface Props {
  value: RestaurantSettings;
  onChange: (next: RestaurantSettings) => void;
  /** Show only one part of the form (used by the setup steps). */
  section?: Section;
}

const label = (d: string) => d.charAt(0).toUpperCase() + d.slice(1);

function numberValue(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export default function RestaurantForm({ value, onChange, section }: Props) {
  const show = (s: Section) => !section || section === s;
  const set = <K extends keyof RestaurantSettings>(key: K, v: RestaurantSettings[K]) => onChange({ ...value, [key]: v });
  const setDay = (d: Weekday, day: DaySettings) => onChange({ ...value, days: { ...value.days, [d]: day } });
  const copyToAll = (d: Weekday) =>
    onChange({
      ...value,
      days: Object.fromEntries(WEEKDAYS.map((x) => [x, { ...value.days[d], lunch: { ...value.days[d].lunch }, dinner: { ...value.days[d].dinner } }])) as Record<Weekday, DaySettings>,
    });

  return (
    <>
      {show("basics") && (
        <section className="panel">
          <h2>Your restaurant</h2>
          <div className="stack-fields">
            <label className="field">
              Restaurant name
              <input type="text" value={value.name} onChange={(e) => set("name", e.target.value)} autoComplete="organization" />
            </label>
            <div className="two-col">
              <label className="field">
                Phone for guests (optional)
                <input type="tel" value={value.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" />
              </label>
              <label className="field">
                Email for guests (optional)
                <input type="email" value={value.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
              </label>
            </div>
            <p className="muted small">
              Your phone and email are filled into reply drafts where it says &ldquo;[phone or email]&rdquo;. They are
              never sent to the AI.
            </p>
          </div>
        </section>
      )}

      {show("hours") && (
        <section className="panel">
          <h2>Opening hours and services</h2>
          <p className="muted small">
            Checks use these to spot visits at times you were closed. Switch off a day if you&apos;re closed, and turn lunch or
            dinner on or off.
          </p>
          <div className="days">
            {WEEKDAYS.map((d) => {
              const day = value.days[d];
              return (
                <fieldset key={d} className={`day ${day.open ? "" : "day-closed"}`}>
                  <legend className="sr-only">{label(d)}</legend>
                  <div className="day-head">
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={day.open}
                        onChange={(e) => setDay(d, { ...day, open: e.target.checked })}
                      />
                      <strong>{label(d)}</strong>
                      <span className="muted small">{day.open ? "Open" : "Closed"}</span>
                    </label>
                    {day.open && (
                      <button type="button" className="btn btn-small" onClick={() => copyToAll(d)}>
                        Use for all days
                      </button>
                    )}
                  </div>
                  {day.open && (
                    <div className="services">
                      {(["lunch", "dinner"] as const).map((svc) => (
                        <div key={svc} className="service-row">
                          <label className="switch">
                            <input
                              type="checkbox"
                              checked={day[svc].on}
                              onChange={(e) => setDay(d, { ...day, [svc]: { ...day[svc], on: e.target.checked } })}
                            />
                            {label(svc)}
                          </label>
                          <div className="time-pair">
                            <input
                              type="time"
                              aria-label={`${label(d)} ${svc} starts`}
                              value={day[svc].start}
                              disabled={!day[svc].on}
                              onChange={(e) => setDay(d, { ...day, [svc]: { ...day[svc], start: e.target.value } })}
                            />
                            <span aria-hidden="true">to</span>
                            <input
                              type="time"
                              aria-label={`${label(d)} ${svc} ends`}
                              value={day[svc].end}
                              disabled={!day[svc].on}
                              onChange={(e) => setDay(d, { ...day, [svc]: { ...day[svc], end: e.target.value } })}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </fieldset>
              );
            })}
          </div>
        </section>
      )}

      {show("capacity") && (
        <section className="panel">
          <h2>Tables and capacity</h2>
          <div className="two-col">
            <label className="field">
              Number of tables
              <input
                type="number"
                min={1}
                max={500}
                inputMode="numeric"
                value={value.tables || ""}
                onChange={(e) => set("tables", numberValue(e.target.value))}
              />
            </label>
            <label className="field">
              Largest party you can seat
              <input
                type="number"
                min={1}
                max={200}
                inputMode="numeric"
                value={value.maxPartySize || ""}
                onChange={(e) => set("maxPartySize", numberValue(e.target.value))}
              />
            </label>
          </div>
          <p className="muted small">
            A review that claims a bigger table than this is flagged as impossible. The number of tables shows how busy each day was.
          </p>
        </section>
      )}
    </>
  );
}
