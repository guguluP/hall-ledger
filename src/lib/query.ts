import { daysFrom } from "@/lib/parse/timetable";
import { fromMinutes, parseClassRange } from "@/lib/time";

export type PlainQuery = {
  day?: number;
  start?: string;
  end?: string;
  seats?: number;
  labs?: boolean;
  projector?: boolean;
  board?: boolean;
  ac?: boolean;
};

function clock(hour: number, minute: number) {
  let h = hour;
  if (h >= 1 && h <= 7) h += 12;
  if (h > 23) return null;
  return fromMinutes(h * 60 + minute);
}

export function parsePlainQuery(input: string): PlainQuery | null {
  const text = input.trim().toLowerCase();
  if (!text || text.length > 120) return null;
  const query: PlainQuery = {};
  if (/\blabs?\b/.test(text)) query.labs = true;
  if (/\bprojector\b/.test(text)) query.projector = true;
  if (/\bsmart ?board\b/.test(text)) query.board = true;
  if (/\bac\b/.test(text) || /\bair[- ]?conditioned\b/.test(text)) query.ac = true;
  const seats = text.match(/\b(?:for|seats?|capacity)\s+(\d{1,3})\b/) || text.match(/\b(\d{1,3})\s+(?:seats|students|people)\b/);
  if (seats) query.seats = Number(seats[1]);
  const dayMatch = text.match(/\b(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:r|rs|rsday)?|fri(?:day)?|sat(?:urday)?)\b/i);
  if (dayMatch) {
    const parsed = daysFrom(dayMatch[1]);
    if (parsed.days.length === 1) query.day = parsed.days[0];
  }
  const clockRange = text.match(/(\d{1,2})[.:](\d{2})\s*(am|pm)?\s*(?:-|–|to)\s*(\d{1,2})[.:](\d{2})\s*(am|pm)?/i);
  if (clockRange) {
    const range = parseClassRange(clockRange[0]);
    if (range) {
      query.start = fromMinutes(range.startMin);
      query.end = fromMinutes(range.endMin);
    }
  } else {
    const short = text.match(/\b(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\b/);
    if (short) {
      const start = clock(Number(short[1]), 0);
      const end = clock(Number(short[2]), 0);
      if (start && end && end > start) {
        query.start = start;
        query.end = end;
      }
    }
  }
  if (!query.day && !query.start && !query.seats && !query.labs && !query.projector && !query.board && !query.ac) return null;
  return query;
}
