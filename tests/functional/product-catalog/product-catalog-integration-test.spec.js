import { test, expect } from "@playwright/test";
import { waitForProductsToLoad } from "../../../utils/helpers.js";

test.describe("Product Catalog Integration Tests", () => {
  test("should maintain cart state while browsing products", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const featuredProducts = page.locator(
      ".product-grid .item-box .product-item"
    );
    const featuredProductsCount = await featuredProducts.count();
    expect(featuredProductsCount).toBeGreaterThan(0);

    // Helper for cart qty
    const getCartQty = async () =>
      Number((await page.locator(".cart-qty").innerText()).replace(/[()]/g, ""));

    for (let i = 0; i < Math.min(featuredProductsCount, 3); i++) {
      const product = featuredProducts.nth(i);

      const initialCartQty = await getCartQty();
      let finalCartQty;

      // Open product details
      await product.locator(".details .product-title a").click();
      await page.waitForLoadState("networkidle");

      // Fill gift card fields if present
      if (await page.locator("#giftcard_2_RecipientName").isVisible()) {
        await page.fill("#giftcard_2_RecipientName", "Test Recipient");
      }
      if (await page.locator("#giftcard_2_RecipientEmail").isVisible()) {
        await page.fill("#giftcard_2_RecipientEmail", "test@example.com");
      }
      if (await page.locator("#giftcard_2_SenderName").isVisible()) {
        await page.fill("#giftcard_2_SenderName", "Test Sender");
      }
      if (await page.locator("#giftcard_2_SenderEmail").isVisible()) {
        await page.fill("#giftcard_2_SenderEmail", "test@example.com");
      }

      // Add to cart if button is available
      const addToCartButton = page.locator(
        "input[class='button-1 add-to-cart-button']"
      );

      if (await addToCartButton.isVisible()) {
        await addToCartButton.click();

        // Wait until cart updates
        await expect(page.locator(".cart-qty")).not.toHaveText(
          `(${initialCartQty})`
        );
        finalCartQty = await getCartQty();

        expect(finalCartQty).toBeGreaterThan(initialCartQty);

        // Navigate to another page (instead of reload)
        await page.goto("/books");
        await page.waitForLoadState("networkidle");

        // Cart should still reflect added item(s)
        const newCartQty = await getCartQty();
        expect(newCartQty).toBe(finalCartQty);
      }
      // Navigate back to homepage for next loop
      await page.goto("/");
      // await page.waitForLoadState("networkidle");
    }      
  });

  test("should handle product availability changes during browsing", async ({
    page,
  }) => {
    // Navigate to homepage and click first product
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const firstProduct = page
      .locator(
        ".product-grid .item-box .product-item .details .product-title a"
      )
      .first();
    await firstProduct.click();
    await page.waitForLoadState("networkidle");

    // Locate Add to Cart button
    const addToCartButton = page.locator("input.button-1.add-to-cart-button");

    // Record initial availability
    let initialAvailability = null;
    if (await addToCartButton.isVisible()) {
      initialAvailability = await addToCartButton.isEnabled();
      await expect(addToCartButton).toBeVisible();
    }

    // Refresh page to simulate stock status update
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Check availability again
    const refreshedButton = page.locator("input.button-1.add-to-cart-button");
    let refreshedAvailability = null;
    if (await refreshedButton.isVisible()) {
      refreshedAvailability = await refreshedButton.isEnabled();
      await expect(refreshedButton).toBeVisible();
    }

    // Assertions
    if (page.url().includes("test-out-of-stock")) {
      // For a special "stock test" product
      expect(initialAvailability).toBe(true);
      expect(refreshedAvailability).toBe(false);
      await expect(page.getByText(/out of stock|unavailable/i)).toBeVisible();
    } else {
      // For normal products, availability should not change
      expect(refreshedAvailability).toBe(initialAvailability);
    }
  });

  test("should handle concurrent user interactions", async ({ browser }) => {
    // Create two separate user sessions
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();

    const context2 = await browser.newContext();
    const page2 = await context2.newPage();

    // Navigate both users to the same product
    const productUrl = "/141-inch-laptop"; // adjust if needed
    await Promise.all([page1.goto(productUrl), page2.goto(productUrl)]);

    // Locate add-to-cart buttons
    const addToCart1 = page1.locator("input.button-1.add-to-cart-button");
    const addToCart2 = page2.locator("input.button-1.add-to-cart-button");

    // Ensure both buttons are ready
    await Promise.all([
      expect(addToCart1).toBeEnabled(),
      expect(addToCart2).toBeEnabled(),
    ]);

    // Both users add to cart "concurrently"
    await Promise.all([addToCart1.click(), addToCart2.click()]);

    // Both should see success notification
    const successMessage = /The product has been added to your shopping cart/i;
    await Promise.all([
      expect(page1.locator(".bar-notification")).toContainText(successMessage),
      expect(page2.locator(".bar-notification")).toContainText(successMessage),
    ]);

    // Clean up
    await context1.close();
    await context2.close();
  });
  
});
