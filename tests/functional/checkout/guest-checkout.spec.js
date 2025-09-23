import { test } from "@playwright/test";
import {
  addProductToCart,
  proceedToCheckout,
  getCartTotal,
  testData,
  checkoutAsGuest,
  fillBillingAddress,
  validateShippingAddress,
  selectShippingMethod,
  fillPaymentMethod,
  fillPaymentInfo,
  confirmOrder,
  confirmationMessage,
} from "../../../utils/helpers";

test.describe("Guest Checkout", () => {
  test.beforeEach(async ({ page }) => {
    // Clear any existing sessions
    await page.context().clearCookies();
    await page.goto("/");

    // Add product to cart
    await addProductToCart(page, testData.testProducts[0].name);

    // Navigate the cart
    await page.goto("/cart");
    await page.waitForLoadState("networkidle");
  });

  test.only("should complete checkout without account", async ({ page }) => {
    test.setTimeout(60000);

    const cartTotalPrice = await getCartTotal(page);

    await proceedToCheckout(page);
    await checkoutAsGuest(page);

    const user = await fillBillingAddress(
      page,
      testData.guestUser
    );

    await validateShippingAddress(page, user);
    await selectShippingMethod(page, testData.shippingMethods[2]);
    await fillPaymentMethod(page, testData.paymentMethods[3]);
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
});
