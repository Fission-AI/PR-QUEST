import { expect, test } from "@playwright/test";

test.describe("Home page", () => {
  test("shows the Phase 0 placeholder experience", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /build the pr review quest/i,
      }),
    ).toBeVisible();

    await expect(page.getByText(/Phase 0 ready/i)).toBeVisible();
  });
});
