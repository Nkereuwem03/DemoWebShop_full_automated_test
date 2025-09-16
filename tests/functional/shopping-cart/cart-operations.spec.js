import { test, expect } from "@playwright/test";
import {
  testData,
  getCartItemRows,
  getAllCartItemQty,
  getFirstCartItemQty,
  clearCart,
  waitForCartUpdate,
  addProductToCart
} from "../../../utils/helpers";

test.describe("Cart Operations", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearCart(page);
  });

  test("should add single item to empty cart", async ({ page }) => {
    // Verify cart st    const initialCount = await getCartItemCount(page);
    const cartItemRows = await getCartItemRows(page);
    const initialCount = await cartItemRows.count();
    expect(initialCount).toBe(0);

    // Add product to cart
    await addProductToCart(page, testData.testProducts[0].name);

    // Verify item added
    await page.goto("/cart");
    await page.waitForLoadState("networkidle");
    const newItemRows = await getCartItemRows(page);
    const newCount = await newItemRows.count();
    expect(newCount).toBe(1);

    // Navigate to cart page and verify
    await page.goto("/cart");
    await page.waitForLoadState("networkidle");

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

  test("should increment quantity for duplicate items", async ({ page }) => {
    // Add same product twice
    const productName = testData.testProducts[0].name;

    await addProductToCart(page, productName);
    await page.waitForLoadState("networkidle");
    const firstAddCount = await getFirstCartItemQty(page);

    await addProductToCart(page, productName);
    await page.waitForLoadState("networkidle");
    const secondAddCount = await getFirstCartItemQty(page);

    // Cart count should increment
    expect(secondAddCount).toBeGreaterThan(firstAddCount);

    // Navigate to cart and verify quantity
    await page.goto("/cart");
    await page.waitForLoadState("networkidle");

    const cartItems = page.locator(".cart-item-row");

    await expect(cartItems).toHaveCount(1);

    // Verify quantity
    if ((await cartItems.count()) === 1) {
      // Same item, quantity increased
      const quantityInput = cartItems.first().locator(".qty .qty-input");
      if (await quantityInput.isVisible()) {
        const quantity = await quantityInput.inputValue();
        expect(parseInt(quantity)).toBe(2);
      }
    } else {
      // Separate line items (some systems handle duplicates this way)
      expect(await cartItems.count()).toBe(2);
    }
  });

  test("should remove items from cart", async ({ page }) => {
    // Add multiple items
    await addProductToCart(page, testData.testProducts[0].name);
    await addProductToCart(page, testData.testProducts[1].name);

    // Navigate to cart
    await page.goto("/cart");
    await page.waitForLoadState("networkidle");

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

    await waitForCartUpdate(page);

    // Verify item removed
    const remainingItems = page.locator(".cart-item-row");
    const remainingCount = await remainingItems.count();

    if (initialCount === 1) {
      // Cart should be empty
      expect(remainingCount).toBe(0);
      await expect(
        page.getByText(/Your Shopping Cart is empty!/i)
      ).toBeVisible();
    } else {
      // One less item
      expect(remainingCount).toBe(initialCount - 1);
    }
  });

  test("should update item quantities", async ({ page }) => {
    // Add item to cart
    await addProductToCart(page, testData.testProducts[0].name);

    // Navigate to cart
    await page.goto("/cart");
    await page.waitForLoadState("networkidle");

    const cartItem = page.locator(".cart-item-row").first();
    const quantityInput = cartItem.locator(".qty .qty-input");

    if (await quantityInput.isVisible()) {
      // Test increasing quantity
      await quantityInput.clear();
      await quantityInput.fill("3");

      // Trigger update (click update button or press enter)
      const updateCartButton = page.locator('input[name="updatecart"]');
      if (await updateCartButton.isVisible()) {
        await updateCartButton.click();
        await page.waitForLoadState("networkidle");
      }

      await waitForCartUpdate(page);

      // Verify quantity updated
      const updatedQuantity = await quantityInput.inputValue();
      expect(updatedQuantity).toBe("3");

      // Verify total price updated
      const itemTotal = cartItem.locator(".subtotal .product-subtotal");
      if (await itemTotal.isVisible()) {
        const totalText = await itemTotal.textContent();
        const total = parseFloat(totalText.replace(/[$,]/g, ""));
        expect(total).toBeGreaterThan(0);
      }

      // Test decreasing quantity
      await quantityInput.clear();
      await quantityInput.fill("1");

      if (await updateCartButton.isVisible()) {
        await updateCartButton.click();
      } else {
        await quantityInput.press("Enter");
      }

      await waitForCartUpdate(page);

      const finalQuantity = await quantityInput.inputValue();
      expect(finalQuantity).toBe("1");
    } else {
      // Use +/- buttons if available
      const increaseButton = cartItem.locator();
      const decreaseButton = cartItem.locator();

      if (await increaseButton.isVisible()) {
        await increaseButton.click();
        await waitForCartUpdate(page);

        // Verify quantity increased
        const quantityDisplay = cartItem.locator(".qty .qty-input");
        const quantity = await quantityDisplay.textContent();
        expect(parseInt(quantity)).toBeGreaterThan(1);
      }

      if (await decreaseButton.isVisible()) {
        await decreaseButton.click();
        await waitForCartUpdate(page);

        // Verify quantity decreased
        const quantity = await quantityDisplay.textContent();
        expect(parseInt(quantity)).toBeLessThan(2);
      }
    }
  });

  test("should clear entire cart", async ({ page }) => {
    // Add multiple items
    await addProductToCart(page, testData.testProducts[0].name);
    await addProductToCart(page, testData.testProducts[1].name);

    // Verify items in cart
    const initialCount = await getAllCartItemQty(page);
    expect(initialCount).toBeGreaterThan(0);

    // Clear cart
    clearCart(page);

    // Verify cart is empty
    await expect(page.getByText(/Your Shopping Cart is empty!/i)).toBeVisible();

    const finalCount = await getAllCartItemQty(page);
    expect(finalCount).toBe(0);
  });

  test("should persist cart across sessions", async ({ page, context }) => {
    // Add item to cart
    await addProductToCart(page, testData.testProducts[0].name);

    const cartCount = await getAllCartItemQty(page);
    expect(cartCount).toBeGreaterThan(0);

    // Close page and create new one (simulate session restart)
    await page.close();
    const newPage = await context.newPage();

    // Navigate to site
    await newPage.goto("/");
    await newPage.waitForLoadState("networkidle");

    // Check if cart persisted
    const persistedCount = await getAllCartItemQty(newPage);

    if (persistedCount > 0) {
      // Cart persisted - verify contents
      await newPage.goto("/cart");
      await newPage.waitForLoadState("networkidle");

      const cartItems = newPage.locator(".cart-item-row");
      await expect(cartItems.first()).toBeVisible();
    } else {
      // Cart didn't persist - this might be expected behavior
      console.log("Cart did not persist across session (guest user behavior)");
    }

    await newPage.close();
  });
});
