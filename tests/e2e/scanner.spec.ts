import { test, expect } from "@playwright/test";
test("inventory → real API → report → honest beta submission state", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Use example inventory" }).click();
  await page.getByRole("button", { name: "Generate upgrade report" }).click();
  const report = page.getByRole("article", { name: "Jenkins upgrade report" });
  await expect(report).toBeVisible();
  await expect(report.getByRole("heading", { name: "Blockers" })).toBeVisible();
  await expect(
    report.getByText("Java migration required", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Installed plugin inventory")).toHaveValue("");
  await page.getByRole("button", { name: "Request paid rehearsal" }).click();
  await page.getByLabel("Work email").fill("qa@example.com");
  await page.getByLabel("I would consider paying").check();
  await page.getByRole("button", { name: "Submit paid-beta interest" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Supabase configuration",
  );
  expect(errors).toEqual([]);
});
test("upload and duplicate validation on mobile without page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("Current Jenkins version").fill("2.440.3");
  await page.locator("#upload").setInputFiles({
    name: "plugins.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("git:5.2.1\ngit:5.2.1"),
  });
  await page.getByRole("button", { name: "Generate upgrade report" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Line 2: Duplicate",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Privacy & methodology" }).click();
  await expect(
    page.getByRole("heading", { name: "Your Jenkins stays yours." }),
  ).toBeVisible();
});
