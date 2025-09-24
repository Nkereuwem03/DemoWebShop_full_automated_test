import { test, expect } from "@playwright/test";
import {
  login,
  addProductToWishlist,
  testData
} from "../../../utils/helpers";

test.describe("Wishlist", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, testData.registeredUser);
  });

  test("should add items to wishlist", async ({ page }) => {
    // Navigate to a product page
    await addProductToWishlist(page, testData.testProducts[0].name);

    // Navigate to wishlist
    await page.goto("/wishlist");

    // Verify cart contains the item
    const cartItems = page.locator(".cart-item-row");
    await expect(cartItems).toHaveCount(1);

    // Verify item details
    const firstItem = cartItems.first();
    await expect(firstItem.locator(".product-picture img")).toBeVisible();
    await expect(firstItem.locator(".product a")).toBeVisible();
    await expect(
      firstItem.locator(".unit-price .product-unit-price")
    ).toBeVisible();
  });

  test.only("should remove items from wishlist", async ({ page }) => {
    // Navigate to a product page
    await addProductToWishlist(page, testData.testProducts[0].name);

    // Navigate to wishlist
    await page.goto("/wishlist");

    const initialItems = page.locator(".cart-item-row");
    const initialCount = await initialItems.count();
    expect(initialCount).toBeGreaterThan(0);

    // Remove first item
    const removeButton = initialItems
      .first()
      .locator(".remove-from-cart input[type='checkbox']");
    await expect(removeButton).toBeVisible();
    await removeButton.check();
    const updateCartButton = page.locator('input[name="updatecart"]');
    if (await updateCartButton.isVisible()) {
      await updateCartButton.click();
      await page.waitForLoadState("networkidle");
    }
  });
});
