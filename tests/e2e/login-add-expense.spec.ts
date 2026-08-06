import { test, expect } from "@playwright/test";
import { login, enterAmount } from "./helpers";

test("login, add an expense, dashboard total updates", async ({ page }) => {
  await login(page);

  // Freshly seeded test user has no expenses this month yet.
  await expect(page.getByText("Nothing spent this month yet")).toBeVisible();

  await page.getByRole("button", { name: "Add expense" }).click();
  await page.getByRole("button", { name: "Food", exact: true }).click();
  await enterAmount(page, "150");
  const addResponse = page.waitForResponse(
    (res) => res.url().includes("/api/expenses") && res.request().method() === "POST"
  );
  // The total card only appears once the invalidated summary query refetches.
  const summaryResponse = page.waitForResponse(
    (res) => res.url().includes("/api/summary/monthly") && res.request().method() === "GET"
  );
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await addResponse;
  await summaryResponse;

  // Sheet closes on successful save.
  await expect(page.getByRole("button", { name: "Add Expense", exact: true })).toBeHidden();

  await expect(page.locator('p:has-text("Total spent") + p')).toHaveText("₹150", { timeout: 15_000 });
});
