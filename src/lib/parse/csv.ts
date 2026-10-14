export class CsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvError";
  }
}

const MAX_ROWS = 2000;
const MAX_COLS = 60;
const MAX_CELL = 500;

export function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new CsvError("File is not valid UTF-8. In Excel choose Save As → CSV UTF-8.");
  }
}

export function detectDelimiter(text: string): "," | ";" | "\t" {
  let inQuotes = false;
  const counts = { ",": 0, ";": 0, "\t": 0 };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && (char === "\n" || char === "\r")) break;
    if (!inQuotes && (char === "," || char === ";" || char === "\t")) counts[char] += 1;
  }
  let best: "," | ";" | "\t" = ",";
  let score = counts[","];
  if (counts[";"] > score) {
    best = ";";
    score = counts[";"];
  }
  if (counts["\t"] > score) best = "\t";
  return best;
}

export function parseCsv(input: string, delimiter?: "," | ";" | "\t"): string[][] {
  let text = input;
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const sep = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    if (field.length > MAX_CELL) {
      throw new CsvError(`A cell exceeds ${MAX_CELL} characters.`);
    }
    row.push(field);
    if (row.length > MAX_COLS) throw new CsvError(`A row exceeds ${MAX_COLS} columns.`);
    field = "";
  };

  const pushRow = () => {
    rows.push(row);
    if (rows.length > MAX_ROWS) throw new CsvError(`File exceeds ${MAX_ROWS} rows.`);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
          continue;
        }
        inQuotes = false;
        continue;
      }
      if (char !== "\r") field += char;
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === sep) {
      pushField();
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      pushField();
      pushRow();
      continue;
    }
    field += char;
  }

  if (inQuotes) throw new CsvError("The file has an unclosed quote.");
  if (field.length > 0 || row.length > 0) {
    pushField();
    pushRow();
  }
  while (rows.length > 0 && rows[rows.length - 1].every((cell) => cell === "")) rows.pop();
  return rows;
}
