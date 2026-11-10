import { HttpError } from "@/lib/http-error";

const HOSTS = new Set(["docs.google.com"]);

function allowed(hostname: string) {
  return HOSTS.has(hostname) || hostname.endsWith(".googleusercontent.com");
}

export function sheetsExportUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new HttpError(400, "Paste a Google Sheets link.");
  }
  if (url.protocol !== "https:" || !allowed(url.hostname)) {
    throw new HttpError(400, "Only a docs.google.com spreadsheet link is accepted.");
  }
  const id = url.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!id) throw new HttpError(400, "That link is not a Google Sheet.");
  return `https://docs.google.com/spreadsheets/d/${id[1]}/export?format=csv`;
}

export async function fetchSheetCsv(input: string) {
  let current = sheetsExportUrl(input);
  for (let hop = 0; hop < 2; hop++) {
    const response = await fetch(current, { redirect: "manual", headers: { accept: "text/csv" } });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new HttpError(400, "Google Sheets did not return the file.");
      const next = new URL(location, current);
      if (next.protocol !== "https:" || !allowed(next.hostname)) {
        throw new HttpError(400, "The sheet download left Google. It was not fetched.");
      }
      current = next.toString();
      continue;
    }
    if (!response.ok) throw new HttpError(400, "The sheet could not be downloaded. Share it as 'Anyone with the link'.");
    const text = await response.text();
    if (text.length > 1_048_576) throw new HttpError(413, "That sheet is too large.");
    if (/<!doctype html|<html/i.test(text.slice(0, 400))) {
      throw new HttpError(400, "The sheet is not public. In Google Sheets use File → Share → Anyone with the link, or download CSV.");
    }
    return text;
  }
  throw new HttpError(400, "The sheet download left Google. It was not fetched.");
}
