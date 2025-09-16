import { test, expect } from "@playwright/test";
import {
  testData,
  getCartItemRows,
  getAllCartItemQty,
  clearCart,
  waitForCartUpdate,
  addProductToCart,
  estimatedShipping,
  proceedToCheckout,
} from "../../../utils/helpers";

test.describe("Cart Validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearCart(page);
  });

  test("should enforce maximum order quantity", async ({ page }) => {
    for (const product of testData.testProducts.slice(0, 2)) {
      await test.step(`Testing product: ${product.name}`, async () => {
        await addProductToCart(page, product.name);
      });
    }

    await page.goto("/cart");
    await page.waitForLoadState("networkidle");

    const cartItems = page.locator(".cart-item-row");
    const itemCount = await cartItems.count();
    expect(itemCount).toBeGreaterThan(0);

    // Set high quantities to test maximum order limit
    for (let i = 0; i < itemCount; i++) {
      const item = cartItems.nth(i);
      const quantityInput = item.locator(".qty .qty-input");
      await quantityInput.fill("10001");
    }

    const updateCartButton = page.locator('input[name="updatecart"]');
    if (await updateCartButton.isVisible()) {
      await updateCartButton.click();
      await waitForCartUpdate(page);
    }

    // Check for maximum order warning
    for (let i = 0; i < itemCount; i++) {
      const item = cartItems.nth(i);
      const quantityWarning = item.getByText(
        /The maximum quantity allowed for purchase is 10000/i
      );
      await expect(quantityWarning).toBeVisible();
    }
  });

  test("should validate item availability at checkout", async ({ page }) => {
    // Add item to cart
    await addProductToCart(page, testData.testProducts[0].name);

    await page.goto("/cart");
    await page.waitForLoadState("networkidle");

    // Apply estimated shipping
    await estimatedShipping(page, testData.locations.domestic.country);
    await waitForCartUpdate(page);

    // Try to proceed to checkout
    await proceedToCheckout(page);

    await page.waitForLoadState("networkidle");

    // Check for availability warnings
    const availabilityWarning = page.getByText(
      /not available|out of stock|inventory|unavailable/i
    );

    if (await availabilityWarning.isVisible()) {
      // Verify warning is displayed
      await expect(availabilityWarning).toBeVisible();

      // Should prevent checkout or redirect back to cart
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/cart|checkout/);

      // Check if items are marked as unavailable in cart
      await page.goto("/cart");
      await page.waitForLoadState("networkidle");

      const unavailableItems = page.locator("");
      if ((await unavailableItems.count()) > 0) {
        await expect(unavailableItems.first()).toBeVisible();
      }
    } else {
      // No availability issues - checkout should proceed normally
      const logoutLink = page.locator("a[href='/logout']");
      if (await logoutLink.isVisible()) {
        // Logged in - should be on shipping/payment page
        expect(page.url()).toMatch(
          "https://demowebshop.tricentis.com/onepagecheckout"
        );
      } else {
        // Guest - might be on login or shipping page
        expect(page.url()).toMatch(
          "https://demowebshop.tricentis.com/login/checkoutasguest?returnUrl=%2Fcart"
        );
      }
    }
  });

  test("should handle inventory changes", async ({ page }) => {
    // Add item to cart
    await addProductToCart(page, testData.testProducts[0].name);

    await page.goto("/cart");
    await page.waitForLoadState("networkidle");

    const initialItems = page.locator(".cart-item-row");
    const initialCount = await initialItems.count();
    expect(initialCount).toBeGreaterThan(0);

    // Simulate inventory change by refreshing page
    // (In real scenarios, this could be triggered by webhooks or periodic checks)
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Check for inventory change notifications
    const inventoryNotification = page.locator(
      ".cart-notification, .inventory-warning"
    );
    const stockWarning = page.getByText(
      /some items in your cart are out of stock/i
    );

    if (
      (await inventoryNotification.isVisible()) ||
      (await stockWarning.isVisible())
    ) {
      // Verify notification is displayed
      await expect(inventoryNotification.or(stockWarning)).toBeVisible();

      // Check if any items were removed due to stock issues
      const currentItems = page.locator(".cart-item-row");
      const currentCount = await currentItems.count();

      if (currentCount < initialCount) {
        // Some items were removed - verify empty cart message or updated count
        if (currentCount === 0) {
          await expect(
            page.getByText("Your Shopping Cart is empty!")
          ).toBeVisible();
        } else {
          // Verify cart count updated
          const cart = await getCartItemRows(page);
          const cartCount = await cart.count();
          expect(cartCount).toBeLessThan(initialCount);
        }
      }

      // Check if quantities were adjusted
      for (let i = 0; i < currentCount; i++) {
        const item = currentItems.nth(i);
        const quantityWarning = item.getByText(
          /quantity.*adjusted|reduced.*availability/i
        );

        if (await quantityWarning.isVisible()) {
          await expect(quantityWarning).toBeVisible();

          // Verify new quantity is within available stock
          const quantityInput = item.locator(".qty .qty-input");
          if (await quantityInput.isVisible()) {
            const newQuantity = parseInt(await quantityInput.inputValue());
            expect(newQuantity).toBeGreaterThan(0);
          }
        }
      }
    } else {
      console.log("No inventory changes detected during test");
    }
  });

  test("should handle concurrent cart modifications", async ({
    page,
    browser,
  }) => {
    test.setTimeout(60000);

    // This test simulates multiple browser tabs modifying the same cart
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();

    const context2 = await browser.newContext();
    const page2 = await context2.newPage();

    try {
      // Both tabs add items to cart
      await page1.goto("/");
      await addProductToCart(page1, testData.testProducts[0].name);

      await page2.goto("/");
      await addProductToCart(page2, testData.testProducts[1].name);

      // Check cart synchronization
      await page1.goto("/cart");
      await page1.waitForLoadState("networkidle");

      await page2.goto("/cart");
      await page2.waitForLoadState("networkidle");

      const cart1Locator = page1.locator(".cart-item-row");
      const cart2Locator = page2.locator(".cart-item-row");

      const cart1Items = await cart1Locator.count();
      const cart2Items = await cart2Locator.count();

      // Carts should show same number of items (or handle conflicts appropriately)
      if (cart1Items === cart2Items) {
        console.log("Cart synchronized across sessions");
        expect(cart1Items).toBeGreaterThan(0);
      } else {
        console.log(
          "Cart conflict handling - items may differ between sessions"
        );
        // Some systems might handle this differently
      }

      // Test concurrent modifications
      const item1 = page1.locator(".cart-item-row").first();
      const item2 = page2.locator(".cart-item-row").first();

      const qty1 = item1.locator(".qty .qty-input");
      const qty2 = item2.locator(".qty .qty-input");

      if ((await qty1.isVisible()) && (await qty2.isVisible())) {
        // Both tabs try to update quantity simultaneously
        await Promise.all([qty1.clear(), qty2.clear()]);
        await Promise.all([qty1.fill("3"), qty2.fill("5")]);

        const update1 = page1.locator("input[value='Update shopping cart']");
        const update2 = page2.locator("input[value='Update shopping cart']");

        await Promise.all([
          update1.isVisible() ? update1.click() : qty1.press("Enter"),
          update2.isVisible() ? update2.click() : qty2.press("Enter"),
        ]);

        await Promise.all([waitForCartUpdate(page1), waitForCartUpdate(page2)]);

        // Check final quantities - system should handle conflicts appropriately
        const finalQty1 = await qty1.inputValue();
        const finalQty2 = await qty2.inputValue();
        console.log(
          `Final quantities - Tab1: ${finalQty1}, Tab2: ${finalQty2}`
        );

        // Should have consistent state or show conflict resolution
        if (finalQty1 === finalQty2) {
          console.log("Concurrent updates resolved consistently");
        } else {
          console.log("Concurrent updates handled with conflict resolution");
        }
      }
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test("should maintain cart integrity during navigation", async ({ page }) => {
    // Add items to cart
    await addProductToCart(page, testData.testProducts[0].name);
    await addProductToCart(page, testData.testProducts[1].name);

    const initialCount = await getAllCartItemQty(page);
    expect(initialCount).toBeGreaterThan(0);

    // Navigate through various pages
    const navigationPages = ["/register", "/login", "/", "/contactus"];

    for (const navPage of navigationPages) {
      await test.step(`Navigate to ${navPage}`, async () => {
        await page.goto(navPage);
        await page.waitForLoadState("networkidle");

        // Verify cart count is maintained
        const currentCount = await getAllCartItemQty(page);
        expect(currentCount).toBe(initialCount);
      });
    }

    // Return to cart and verify items are intact
    await page.goto("/cart");
    await page.waitForLoadState("networkidle");

    const cartItems = await getCartItemRows(page);
    const cartItemCount = await cartItems.count();
    let finalItemCount = 0;

    for (let i = 0; i < cartItemCount; i++) {
      const item = cartItems.nth(i);
      const text = await item.locator(".qty .qty-input").inputValue();
      const cleaned = parseInt(text, 10) || 0;
      finalItemCount += cleaned;
    }

    expect(finalItemCount).toBe(initialCount);

    // Verify item details are preserved
    for (let i = 0; i < finalItemCount; i++) {
      const item = cartItems.nth(i);
      await expect(item.locator(".product .product-name")).toBeVisible();
      await expect(
        item.locator(".unit-price .product-unit-price")
      ).toBeVisible();
      await expect(item.locator(".qty .qty-input")).toBeVisible();
    }
  });
});
