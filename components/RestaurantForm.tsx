"use client";

import { useState } from "react";
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

const sameWindows = (a: DaySettings, b: DaySettings) => JSON.stringify([a.lunch, a.dinner]) === JSON.stringify([b.lunch, b.dinner]);
const short = (d: string) => label(d).slice(0, 3);

export default function RestaurantForm({ value, onChange, section }: Props) {
  const openDays = WEEKDAYS.filter((d) => value.days[d].open);
  const [same, setSame] = useState(() => openDays.every((d) => sameWindows(value.days[d], value.days[openDays[0]])));
  const show = (s: Section) => !section || section === s;
  const set = <K extends keyof RestaurantSettings>(key: K, v: RestaurantSettings[K]) => onChange({ ...value, [key]: v });
  const setDay = (d: Weekday, day: DaySettings) => onChange({ ...value, days: { ...value.days, [d]: day } });
  // With "same every day" on, one editor sets the lunch and dinner times of every open day.
  const sameDay: DaySettings = value.days[openDays[0] ?? "monday"];
  const setSameDay = (day: DaySettings) =>
    onChange({
      ...value,
      days: Object.fromEntries(
        WEEKDAYS.map((x) => [x, { open: value.days[x].open, lunch: { ...day.lunch }, dinner: { ...day.dinner } }]),
      ) as Record<Weekday, DaySettings>,
    });
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
              <input type="text" value={value.name} placeholder="e.g. Spice Garden" onChange={(e) => set("name", e.target.value)} autoComplete="organization" />
              <span className="field-help">Shown on reports and reply drafts.</span>
            </label>
            <div className="two-col">
              <label className="field">
                Phone for guests (optional)
                <input type="tel" value={value.phone} placeholder="e.g. +91 98765 43210" onChange={(e) => set("phone", e.target.value)} autoComplete="tel" />
                <span className="field-help">Added to reply drafts so guests can contact you.</span>
              </label>
              <label className="field">
                Email for guests (optional)
                <input type="email" value={value.email} placeholder="e.g. hello@spicegarden.in" onChange={(e) => set("email", e.target.value)} autoComplete="email" />
                <span className="field-help">Also added to reply drafts. Never sent to the AI.</span>
              </label>
            </div>
          </div>
        </section>
      )}

      {show("hours") && (
        <section className="panel">
          <h2>Opening hours and services</h2>
          <p className="muted small">
            Checks use these to spot visits at times you were closed.
          </p>
          <label className="switch same-toggle">
            <input
              type="checkbox"
              checked={same}
              onChange={(e) => {
                setSame(e.target.checked);
                if (e.target.checked) setSameDay(sameDay);
              }}
            />
            <strong>Same hours every day</strong>
          </label>

          {same ? (
            <>
              <div className="services services-same">
                {(["lunch", "dinner"] as const).map((svc) => (
                  <div key={svc} className="service-row">
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={sameDay[svc].on}
                        onChange={(e) => setSameDay({ ...sameDay, [svc]: { ...sameDay[svc], on: e.target.checked } })}
                      />
                      {label(svc)}
                    </label>
                    <div className="time-pair">
                      <input
                        type="time"
                        aria-label={`${label(svc)} starts`}
                        value={sameDay[svc].start}
                        disabled={!sameDay[svc].on}
                        onChange={(e) => setSameDay({ ...sameDay, [svc]: { ...sameDay[svc], start: e.target.value } })}
                      />
                      <span aria-hidden="true">to</span>
                      <input
                        type="time"
                        aria-label={`${label(svc)} ends`}
                        value={sameDay[svc].end}
                        disabled={!sameDay[svc].on}
                        onChange={(e) => setSameDay({ ...sameDay, [svc]: { ...sameDay[svc], end: e.target.value } })}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="muted small day-chips-label">Closed on any day? Tap it to mark it Closed.</p>
              <div className="day-chips">
                {WEEKDAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`day-chip ${value.days[d].open ? "" : "day-chip-closed"}`}
                    aria-pressed={!value.days[d].open}
                    aria-label={`${label(d)}: ${value.days[d].open ? "open. Tap to mark Closed" : "Closed. Tap to open"}`}
                    onClick={() => setDay(d, { ...value.days[d], open: !value.days[d].open })}
                  >
                    <span>{short(d)}</span>
                    <small>{value.days[d].open ? "Open" : "Closed"}</small>
                  </button>
                ))}
              </div>
            </>
          ) : (
          <div className="days">
            {WEEKDAYS.map((d) => {
              const day = value.days[d];
              return (
                <fieldset key={d} className={`day ${day.open ? "" : "day-closed"}`}>
                  <legend className="sr-only">{label(d)}</legend>
                  <div className="day-head">
                    <strong>{label(d)}</strong>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={!day.open}
                        onChange={(e) => setDay(d, { ...day, open: !e.target.checked })}
                      />
                      Closed
                    </label>
                    {day.open && (
                      <button type="button" className="btn btn-small" onClick={() => { copyToAll(d); setSame(true); }}>
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
          )}
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
                placeholder="e.g. 12"
                min={1}
                max={500}
                inputMode="numeric"
                value={value.tables || ""}
                onChange={(e) => set("tables", numberValue(e.target.value))}
              />
              <span className="field-help">Count every table guests can sit at.</span>
            </label>
            <label className="field">
              Largest party you can seat
              <input
                type="number"
                placeholder="e.g. 10"
                min={1}
                max={200}
                inputMode="numeric"
                value={value.maxPartySize || ""}
                onChange={(e) => set("maxPartySize", numberValue(e.target.value))}
              />
              <span className="field-help">The biggest group you would seat together.</span>
            </label>
          </div>
          <div className="two-col">
            <label className="field">
              Typical seats per table
              <input
                type="number"
                placeholder="e.g. 4"
                min={1}
                max={50}
                inputMode="numeric"
                value={value.seatsPerTable || ""}
                onChange={(e) => set("seatsPerTable", numberValue(e.target.value))}
              />
              <span className="field-help">An average is fine.</span>
            </label>
            <label className="field">
              How long a party keeps a table (minutes)
              <input
                type="number"
                placeholder="e.g. 90"
                min={15}
                max={360}
                inputMode="numeric"
                value={value.mealMinutes || ""}
                onChange={(e) => set("mealMinutes", numberValue(e.target.value))}
              />
              <span className="field-help">Used to tell whether your tables were full at a given time.</span>
            </label>
          </div>
          <p className="muted small">
            A review that claims a bigger party than your largest is flagged as impossible. If a claimed visit has no matching
            bill and your tables were already full at that time, that counts against it too. A party needs one table for
            every {value.seatsPerTable || 4} guests, rounded up.
          </p>
        </section>
      )}
    </>
  );
}
