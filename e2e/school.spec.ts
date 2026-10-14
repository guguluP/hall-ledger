import { readFileSync } from "fs";
import path from "path";
import { expect, test } from "@playwright/test";

test("sign up, verify, publish a CSV, and search while logged out", async ({ page }) => {
  const email = `play-${Date.now()}@school.test`;
  await page.goto("/signup");
  await page.getByPlaceholder("Name").fill("Play Writer");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("correct-horse");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/account/);

  const log = readFileSync(path.join(process.cwd(), ".mail-dev.log"), "utf8");
  const link = log.trim().split("\n").pop()?.split("\t").pop() || "";
  const token = new URL(link).searchParams.get("token");
  await page.goto(`/auth/verify?token=${token}`);
  await page.getByRole("button", { name: "Verify email" }).click();
  await expect(page).toHaveURL(/\/account/);

  const slug = `play${Date.now().toString().slice(-6)}`;
  await page.goto("/new");
  await page.getByPlaceholder("School name").fill("Play School");
  await page.getByPlaceholder("short-name").fill(slug);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/manage`));

  await page.goto(`/${slug}/manage/rooms`);
  await page.getByPlaceholder("Name").fill("316");
  await page.getByRole("button", { name: "Save room" }).click();
  await expect(page.getByText("316").first()).toBeVisible();

  await page.goto(`/${slug}/manage/upload`);
  await page.locator("input[type=file]").setInputFiles(path.join(process.cwd(), "public/samples/tabular-template.csv"));
  await page.getByRole("button", { name: "Review draft" }).click();
  await expect(page.getByText(/slots, \d+ conflicts/i)).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page).toHaveURL(new RegExp(`/${slug}/timetable`), { timeout: 30_000 });

  await page.goto("/account");
  await page.getByText("Play Writer").click();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await page.goto(`/${slug}/find`);
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page.getByText(/free/i).first()).toBeVisible();
});
