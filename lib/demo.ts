import type { Claim } from "./types";

/**
 * The sample restaurant's reviews come with their claims already pulled out, the way the AI would,
 * so the sample data works with no AI call. The real checking against the records still runs in code.
 */
const claim = (o: Partial<Claim> & Pick<Claim, "text" | "type">): Claim => ({
  party_size: null,
  weekday: null,
  date: null,
  time: null,
  item: null,
  ...o,
});

export const DEMO_CLAIMS: Record<string, Claim[]> = {
  m1: [
    claim({ text: "table of 10 on Friday around 8 PM", type: "party_size", party_size: 10, weekday: "friday", time: "20:00" }),
    claim({ text: "completely ignored", type: "staff" }),
    claim({ text: "waited an hour", type: "wait_time" }),
    claim({ text: "nobody took our order", type: "staff" }),
  ],
  m2: [
    claim({ text: "quick lunch around 1 PM on Tuesday", type: "date_time", weekday: "tuesday", time: "13:00" }),
    claim({ text: "the host said the kitchen wasn't ready", type: "staff" }),
    claim({ text: "stood at the door for 20 minutes", type: "wait_time" }),
  ],
  m3: [
    claim({ text: "reservation for 8 people on Saturday at 9 PM", type: "reservation", party_size: 8, weekday: "saturday", time: "21:00" }),
    claim({ text: "wait 50 minutes for a table", type: "wait_time" }),
    claim({ text: "Management did not care at all", type: "staff" }),
  ],
  b1: [
    claim({ text: "there Saturday around 8 PM", type: "date_time", weekday: "saturday", time: "20:00" }),
    claim({ text: "the staff was rude", type: "staff" }),
    claim({ text: "the food was cold", type: "food_quality" }),
    claim({ text: "everything took forever", type: "wait_time" }),
  ],
  b2: [
    claim({ text: "Got sick after eating there on Friday", type: "food_quality", weekday: "friday" }),
    claim({ text: "Filthy place", type: "other" }),
    claim({ text: "terrible food", type: "food_quality" }),
  ],
  b3: [
    claim({ text: "Got sick after eating there on Friday", type: "food_quality", weekday: "friday" }),
    claim({ text: "Filthy place", type: "other" }),
    claim({ text: "terrible food", type: "food_quality" }),
  ],
  g1: [
    claim({ text: "We went on Thursday around 6:30 PM, party of 4.", type: "party_size", party_size: 4, weekday: "thursday", time: "18:30" }),
    claim({ text: "waited about 35 minutes just for our appetizers", type: "wait_time" }),
    claim({ text: "appetizers", type: "item_ordered", item: "appetizers" }),
    claim({ text: "nobody told us why", type: "staff" }),
    claim({ text: "Service was friendly", type: "staff" }),
  ],
  g2: [
    claim({ text: "Dinner on Tuesday at about 7 PM, just the two of us", type: "party_size", party_size: 2, weekday: "tuesday", time: "19:00" }),
    claim({ text: "my steak", type: "item_ordered", item: "steak" }),
    claim({ text: "well done and dry", type: "food_quality" }),
    claim({ text: "it felt rushed", type: "staff" }),
  ],
  g3: [
    claim({ text: "Sunday evening, around 6 PM, party of 3", type: "party_size", party_size: 3, weekday: "sunday", time: "18:00" }),
    claim({ text: "waited close to 40 minutes for our mains", type: "wait_time" }),
    claim({ text: "the soup arrived lukewarm", type: "food_quality" }),
    claim({ text: "The staff was apologetic", type: "staff" }),
  ],
};

/** Dan K.'s review is the one the sample data opens on. */
export const DEMO_FIRST_REVIEW_ID = "m1";

/** The example review a new owner can drop in to see a result straight away. */
export const EXAMPLE_REVIEW = {
  author: "Example guest",
  rating: 1,
  text: "Our table of 15 on Friday around 8 PM was ignored for an hour. The staff was rude and the food arrived cold.",
  claims: [
    claim({ text: "table of 15 on Friday around 8 PM", type: "party_size", party_size: 15, weekday: "friday", time: "20:00" }),
    claim({ text: "ignored for an hour", type: "wait_time" }),
    claim({ text: "The staff was rude", type: "staff" }),
    claim({ text: "the food arrived cold", type: "food_quality" }),
  ],
};
