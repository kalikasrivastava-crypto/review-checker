import fs from "node:fs";
import path from "node:path";
import { parseOrders, parseReservations, sanitizeUploaded, type Order, type Records, type Reservation } from "./records";
import { DEMO_SETTINGS, sanitizeSettings, toHours, type RestaurantSettings } from "./settings";

let demo: { orders: Order[]; reservations: Reservation[] } | null = null;

/** The built-in demo bills and reservations (server only: it reads the files in /data). */
function loadDemoData() {
  if (!demo) {
    const dir = path.join(process.cwd(), "data");
    const read = (file: string) => fs.readFileSync(path.join(dir, file), "utf8");
    demo = { orders: parseOrders(read("orders.csv")), reservations: parseReservations(read("reservations.csv")) };
  }
  return demo;
}

/**
 * Everything a check needs, from what the browser sent: the owner's uploaded records (or the demo
 * ones) and their restaurant settings (or the demo restaurant). With an upload, a file that was not
 * provided counts as "no records" rather than falling back to demo data.
 */
export function buildRecords(uploaded: unknown, settingsInput: unknown): { records: Records; settings: RestaurantSettings } {
  const base = loadDemoData();
  const custom = sanitizeUploaded(uploaded);
  const settings = sanitizeSettings(settingsInput) ?? DEMO_SETTINGS;
  return {
    records: {
      orders: custom ? custom.orders : base.orders,
      reservations: custom ? custom.reservations : base.reservations,
      hours: toHours(settings),
    },
    settings,
  };
}
