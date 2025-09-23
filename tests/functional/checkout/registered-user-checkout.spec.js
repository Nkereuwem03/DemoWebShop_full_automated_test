import { test, expect } from "@playwright/test";
import {
  addProductToCart,
  proceedToCheckout,
  getCartTotal,
  testData,
  clearCart,
  login,
  fillBillingAddress,
  validateShippingAddress,
  selectShippingMethod,
  fillPaymentMethod,
  fillPaymentInfo,
  confirmOrder,
  confirmationMessage,
  getOrderNumber,
} from "../../../utils/helpers";

test.describe("Registered User Checkout", () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing sessions
    await page.context().clearCookies();

    // Login as registered user
    await login(page, testData.registeredUser);

    // Clear cart
    await clearCart(page);

    // Add product to cart
    await addProductToCart(page, testData.testProducts[0].name);
    await page.waitForLoadState("networkidle");
  });

  test.only("should complete checkout with account", async ({ page }) => {
    test.setTimeout(60000);
    const cartTotalPrice = await getCartTotal(page);
    await proceedToCheckout(page);
    const user = await fillBillingAddress(page, testData.registeredUser);
    await validateShippingAddress(page, testData.registeredUser);
    await selectShippingMethod(page, testData.shippingMethods[1]);
    await fillPaymentMethod(page, testData.paymentMethods[0]);
    await fillPaymentInfo(page, testData.paymentData);
    await confirmOrder(page, cartTotalPrice);
    await confirmationMessage(page);
  });

  test("should send order confirmation", async ({ page, request }) => {
    // Complete full checkout process
    // Wait for order confirmation
    // Verify confirmation details on page
    // Verify order number is displayed
    // If email testing API is available, verify email was sent
  });

  test("should save order to account history", async ({ page }) => {
    test.setTimeout(60000);
    const cartTotalPrice = await getCartTotal(page);
    await proceedToCheckout(page);
    const user = await fillBillingAddress(page, testData.registeredUser);
    await validateShippingAddress(page, user);
    await selectShippingMethod(page, testData.shippingMethods[1]);
    await fillPaymentMethod(page, testData.paymentMethods[0]);
    await fillPaymentInfo(page, testData.paymentData);
    await confirmOrder(page, cartTotalPrice);
    const orderNumber = await getOrderNumber(page);
    console.log(orderNumber);
    if (orderNumber) {
      await page.click(".header-links .account");
      await page.locator(".listbox .list li a", { hasText: /Orders/i }).click();
      expect(page.url()).toContain("/orders");
      await page.waitForLoadState("networkidle");

      const firstOrderItem = page.locator(".order-item .title strong").first();

      await expect(firstOrderItem).toBeVisible();

      const firstOrderText = await firstOrderItem.textContent();

      const firstOrderNumber = firstOrderText?.match(/\d+/)?.[0] ?? null;

      console.log("First order number:", firstOrderNumber);
      expect(firstOrderNumber).toBe(orderNumber);
    } else {
      console.log("Order Number not found");
    }
  });
});

test("should use saved addresses", async ({ page }) => {});

test("should use saved payment methods", async ({ page }) => {});

test("should apply member discounts", async ({ page }) => {});
