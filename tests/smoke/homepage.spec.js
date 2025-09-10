import {test, expect} from "@playwright/test";

test.describe("Homepage Smoke Tests", () => {
    test.beforeEach(async ({page}) => {
        await page.goto("https://demowebshop.tricentis.com/");
    });

    test("should load homepage successfully", async ({ page }) => {
        await expect(page).toHaveTitle("Demo Web Shop");
        await expect(page.locator("a[href='/register']")).toBeVisible();
        await page.waitForLoadState('networkidle');
        await expect(page.locator("body")).toBeVisible();
    });

    test('should display main navigation menu', async ({ page }) => {
        await expect(page.locator('.header-links')).toBeVisible();
        await expect(page.locator('a[href="/register"]')).toBeVisible();
        await expect(page.locator('a[href="/login"]')).toBeVisible();
        await expect(page.locator('li[id="topcartlink"] a[class="ico-cart"]')).toBeVisible();
        await expect(page.locator('a[class="ico-wishlist"] span[class="cart-label"]')).toBeVisible();
    });

    test("should show featured products section", async ({ page }) => {
        const featuredHeader = page.locator(
            "div[class='product-grid home-page-product-grid'] strong"
          );
        await expect(featuredHeader).toBeVisible();
        await expect(featuredHeader).toHaveText("Featured products");
        const featuredItems = page.locator(".item-box .product-item");
        const productCount = await featuredItems.count();
        expect(productCount).toBeGreaterThan(0);
    });

    test("should load without console errors", async ({ page }) => {
      const consoleErrors = [];

      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });

      await page.waitForLoadState("networkidle");

      const criticalErrors = consoleErrors.filter(
        (error) =>
          !error.includes("favicon") &&
          !error.includes("ads") &&
          !error.includes("analytics")
      );

      expect(criticalErrors).toHaveLength(0);
    });
});
