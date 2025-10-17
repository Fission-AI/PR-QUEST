import { expect, test } from "@playwright/test";

test.describe("Home page", () => {
  test("shows the hero and intake card", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /pr quest/i,
      }),
    ).toBeVisible();

    await expect(
      page.getByText(/interactive walkthroughs for real-world pull requests/i),
    ).toBeVisible();
  });
});
