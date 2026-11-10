import { inflateRawSync } from "zlib";
import { HttpError } from "@/lib/http-error";

const MAX_ENTRIES = 32;
const MAX_UNCOMPRESSED = 2_000_000;

function findEocd(bytes: Uint8Array) {
  const start = Math.max(0, bytes.length - 66_000);
  for (let i = bytes.length - 22; i >= start; i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) return i;
  }
  return -1;
}

function u16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes: Uint8Array, offset: number) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function readEntries(bytes: Uint8Array) {
  const eocd = findEocd(bytes);
  if (eocd < 0) throw new HttpError(400, "This Excel file could not be read. Save it as CSV UTF-8 instead.");
  const count = u16(bytes, eocd + 10);
  if (count > MAX_ENTRIES) throw new HttpError(400, "This workbook has too many parts.");
  let offset = u32(bytes, eocd + 16);
  const entries: { name: string; method: number; compressed: number; size: number; local: number }[] = [];
  for (let i = 0; i < count; i++) {
    if (u32(bytes, offset) !== 0x02014b50) throw new HttpError(400, "This Excel file could not be read.");
    const flags = u16(bytes, offset + 8);
    if (flags & 1) throw new HttpError(400, "Password-protected workbooks are not accepted.");
    const method = u16(bytes, offset + 10);
    const compressed = u32(bytes, offset + 20);
    const size = u32(bytes, offset + 24);
    const nameLen = u16(bytes, offset + 28);
    const extraLen = u16(bytes, offset + 30);
    const commentLen = u16(bytes, offset + 32);
    const local = u32(bytes, offset + 42);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLen));
    if (name.includes("..") || name.startsWith("/") || /vbaProject/i.test(name)) {
      throw new HttpError(400, "This workbook is not a plain sheet.");
    }
    entries.push({ name, method, compressed, size, local });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function entryBytes(bytes: Uint8Array, entry: { method: number; compressed: number; size: number; local: number }) {
  if (entry.size > MAX_UNCOMPRESSED || entry.compressed > MAX_UNCOMPRESSED) {
    throw new HttpError(400, "This sheet is too large.");
  }
  const local = entry.local;
  if (u32(bytes, local) !== 0x04034b50) throw new HttpError(400, "This Excel file could not be read.");
  const nameLen = u16(bytes, local + 26);
  const extraLen = u16(bytes, local + 28);
  const dataStart = local + 30 + nameLen + extraLen;
  const data = bytes.subarray(dataStart, dataStart + entry.compressed);
  if (entry.method === 0) return data;
  if (entry.method !== 8) throw new HttpError(400, "This Excel compression is not supported.");
  const inflated = inflateRawSync(data);
  if (inflated.length > MAX_UNCOMPRESSED) throw new HttpError(400, "This sheet is too large.");
  return inflated;
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function assertPlainXml(xml: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new HttpError(400, "This workbook is not a plain sheet.");
}

function sharedStrings(xml: string) {
  assertPlainXml(xml);
  return xml.split(/<si\b[^>]*>/i).slice(1).map((part) => {
    const body = part.split(/<\/si>/i)[0] || "";
    return [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map((match) => decodeXml(match[1])).join("");
  });
}

function columnIndex(ref: string) {
  const letters = (ref.match(/[A-Z]+/i) || [""])[0].toUpperCase();
  let n = 0;
  for (const char of letters) n = n * 26 + char.charCodeAt(0) - 64;
  return n - 1;
}

function rowIndex(ref: string) {
  return Number((ref.match(/\d+/) || ["0"])[0]) - 1;
}

function sheetRows(xml: string, strings: string[]) {
  assertPlainXml(xml);
  const rows = new Map<number, string[]>();
  for (const match of xml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)) {
    const attrs = match[1];
    const ref = (attrs.match(/\br="([^"]+)"/i) || [])[1] || "";
    const kind = ((attrs.match(/\bt="([^"]+)"/i) || [])[1] || "").toLowerCase();
    const row = rowIndex(ref);
    const col = columnIndex(ref);
    if (row < 0 || row > 5000 || col < 0 || col > 40) continue;
    let value = "";
    if (kind === "s") {
      const index = Number((match[2].match(/<v>([\s\S]*?)<\/v>/i) || [])[1] || "");
      value = strings[index] || "";
    } else if (kind === "inlinestr") {
      value = [...match[2].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)].map((item) => decodeXml(item[1])).join("");
    } else if (kind !== "e") {
      value = decodeXml((match[2].match(/<v>([\s\S]*?)<\/v>/i) || [])[1] || "");
    }
    const line = rows.get(row) || [];
    line[col] = value;
    rows.set(row, line);
  }
  return [...rows.keys()].sort((a, b) => a - b).map((key) => rows.get(key) || []);
}

function csvCell(value: string) {
  const text = value ?? "";
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function xlsxToCsv(bytes: Uint8Array) {
  const entries = readEntries(bytes);
  const shared = entries.find((entry) => entry.name === "xl/sharedStrings.xml");
  const sheet = entries.find((entry) => /^xl\/worksheets\/sheet1\.xml$/i.test(entry.name))
    || entries.find((entry) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(entry.name));
  if (!sheet) throw new HttpError(400, "The first worksheet was not found.");
  const strings = shared ? sharedStrings(new TextDecoder().decode(entryBytes(bytes, shared))) : [];
  const rows = sheetRows(new TextDecoder().decode(entryBytes(bytes, sheet)), strings);
  if (!rows.length) throw new HttpError(400, "The worksheet is empty.");
  const width = Math.max(...rows.map((row) => row.length));
  return rows.map((row) => Array.from({ length: width }, (_, index) => csvCell(row[index] || "")).join(",")).join("\n");
}
