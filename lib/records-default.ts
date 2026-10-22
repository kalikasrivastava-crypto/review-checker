import fs from "node:fs";
import path from "node:path";
import { parseOrders, parseReservations, type Hours, type Records } from "./records";

let cache: Records | null = null;

/** The built-in demo dataset (server only: it reads the files in /data). */
export function loadDefaultRecords(): Records {
  if (!cache) {
    const dir = path.join(process.cwd(), "data");
    const read = (file: string) => fs.readFileSync(path.join(dir, file), "utf8");
    cache = {
      orders: parseOrders(read("orders.csv")),
      reservations: parseReservations(read("reservations.csv")),
      hours: JSON.parse(read("hours.json")) as Hours,
    };
  }
  return cache;
}
