import { test, expect } from "@playwright/test";
import { login, enterAmount, backspaceAmount } from "./helpers";

const NOTE = "e2e-crud-note";

test("add an expense, edit it, then delete it", async ({ page }) => {
  await login(page);

  // ── Add ──────────────────────────────────────────────────────────────────
  await page.getByRole("button", { name: "Add expense" }).click();
  await page.getByRole("button", { name: "Travel", exact: true }).click();
  await enterAmount(page, "75");
  await page.getByPlaceholder("e.g. lunch…").fill(NOTE);
  const addResponse = page.waitForResponse(
    (res) => res.url().includes("/api/expenses") && res.request().method() === "POST"
  );
  // The list shows an optimistic row with a fake `optimistic-<ts>` id right
  // away; only this follow-up GET (fired from the mutation's onSettled)
  // replaces it with the real DB id. Editing before it lands would PATCH the
  // fake id and 400.
  const refetchResponse = page.waitForResponse(
    (res) => res.url().includes("/api/expenses?month=") && res.request().method() === "GET"
  );
  await page.getByRole("button", { name: "Add Expense", exact: true }).click();
  await addResponse;
  await refetchResponse;
  await expect(page.getByRole("button", { name: "Add Expense", exact: true })).toBeHidden();

  const row = page.locator("li").filter({ hasText: NOTE });
  await expect(row).toContainText("₹75", { timeout: 10_000 });

  // ── Edit ─────────────────────────────────────────────────────────────────
  await row.getByRole("button", { name: "More options", exact: true }).click();
  await row.getByRole("button", { name: /Edit/ }).click();

  await backspaceAmount(page, 2); // clear the prefilled "75"
  await enterAmount(page, "120");
  const editResponse = page.waitForResponse(
    (res) => res.url().includes("/api/expenses/") && res.request().method() === "PATCH"
  );
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await editResponse; // the PATCH itself, before waiting on the client-side refetch
  await expect(page.getByRole("button", { name: "Save Changes", exact: true })).toBeHidden();

  await expect(row).toContainText("₹120", { timeout: 10_000 });

  // ── Delete ───────────────────────────────────────────────────────────────
  // The row disappears from the DOM optimistically, but the real DELETE only
  // fires after ExpenseList's 5s undo window. Wait for it so the DB is
  // genuinely clean before the next spec runs against this same test user.
  const deleteResponse = page.waitForResponse(
    (res) => res.url().includes("/api/expenses/") && res.request().method() === "DELETE"
  );
  await row.getByRole("button", { name: "More options", exact: true }).click();
  await row.getByRole("button", { name: /Delete/ }).click();
  await row.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(page.locator("li").filter({ hasText: NOTE })).toHaveCount(0, { timeout: 10_000 });
  await deleteResponse;
});
