import type { Page } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "./testUser";

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_EMAIL);
  // exact:true — a loose match also catches the "Show password" toggle button.
  await page.getByLabel("Password", { exact: true }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
}

// AddExpenseSheet has no numeric text input — amount is entered via a custom
// on-screen keypad, one digit/symbol button per tap.
export async function enterAmount(page: Page, amount: string) {
  for (const char of amount) {
    await page.getByRole("button", { name: char, exact: true }).click();
  }
}

export async function backspaceAmount(page: Page, times: number) {
  for (let i = 0; i < times; i++) {
    await page.getByRole("button", { name: "⌫", exact: true }).click();
  }
}
