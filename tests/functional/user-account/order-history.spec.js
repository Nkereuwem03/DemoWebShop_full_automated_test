import { test, expect } from "@playwright/test";
import {
  login,
  getAllCartItemQty,
  proceedToCheckout,
  getCartTotal,
  testData,
  fillBillingAddress,
  validateShippingAddress,
  selectShippingMethod,
  fillPaymentMethod,
  fillPaymentInfo,
  confirmOrder,
  confirmationMessage,
} from "../../../utils/helpers";

test.describe("Order History", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, testData.registeredUser);
  });

  test("should display past orders", async ({ page }) => {
    await page.click(".header-links .account");

    await page.click(".list li a[href='/customer/orders']");

    const orderHistory = page.locator(
      '.order-list, .order-history, [data-testid="order-history"]'
    );
    const noOrdersMessage = page.getByText(
      /no orders|haven't placed|order history is empty/i
    );
    const orderItems = page.locator(
      '.order-item, .order-row, [data-testid="order-item"]'
    );

    // Check if user has order history
    if ((await orderItems.count()) > 0) {
      // Verify order list is displayed
      await expect(orderItems.first()).toBeVisible();

      const orderCount = await orderItems.count();
      expect(orderCount).toBeGreaterThan(0);

      // Verify each order has required information
      for (let i = 0; i < Math.min(orderCount, 3); i++) {
        const order = orderItems.nth(i);

        // Should have order number

        const orderNumber = page
          .locator("div[class='section order-item'] strong")
          .first();
        await expect(orderNumber).toBeVisible();

        if (await orderNumber.isVisible()) {
          const numberText = await orderNumber.textContent();
          expect(numberText).toMatch(/\d+/);
        }

        /*
        // Should have order date
        const orderDate = order.locator();
        if (await orderDate.isVisible()) {
          const dateText = await orderDate.textContent();
          expect(dateText).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/);
        }

        // Should have order total
        const orderTotal = order.locator();
        if (await orderTotal.isVisible()) {
          const totalText = await orderTotal.textContent();
          expect(totalText).toMatch(/\$\d+\.\d{2}/);
        }

        // Should have order status
        const orderStatus = order.locator();
        if (await orderStatus.isVisible()) {
          const statusText = await orderStatus.textContent();
          expect(statusText).toMatch(
            /pending|processing|shipped|delivered|cancelled|completed/i
          );
        }
        */
      }
    } else if (await noOrdersMessage.isVisible()) {
      // No orders scenario
      await expect(noOrdersMessage).toBeVisible();
      console.log("User has no order history");
    } else {
      test.skip("Order history section not found");
    }
  });

  test("should show order details", async ({ page }) => {
    // Navigate to orders page
    await page.click(".header-links .account");
    await page.click(".list li a[href='/customer/orders']");

    // Locators for order history page
    const orderHistory = page.locator(
      '.order-list, .order-history, [data-testid="order-history"]'
    );
    const noOrdersMessage = page.getByText(
      /no orders|haven't placed|order history is empty/i
    );
    const orderListItems = page.locator(
      '.order-item, .order-row, [data-testid="order-item"]'
    );

    if ((await orderListItems.count()) > 0) {
      // Verify order list is displayed
      await expect(orderListItems.first()).toBeVisible();

      const orderCount = await orderListItems.count();
      expect(orderCount).toBeGreaterThan(0);

      const firstOrder = orderListItems.first();
      const viewDetailsButton = firstOrder.getByRole("button", {
        name: /details|view|show/i,
      });

      if (await viewDetailsButton.isVisible()) {
        await viewDetailsButton.click();
      }

      await page.waitForLoadState("networkidle");

      // Verify order details page
      await expect(
        page.getByRole("heading", {
          name: /Order information|order.*details|order.*#/i,
        })
      ).toBeVisible();

      // Order details section
      const orderInfo = page.locator(".page-body");

      if (await orderInfo.isVisible()) {
        // Check for order number
        await expect(
          orderInfo.getByText(/order.*#|order.*number/i)
        ).toBeVisible();

        // Check for order date
        await expect(
          orderInfo.getByText(/order.*date|placed.*on/i)
        ).toBeVisible();

        // Check for order status
        await expect(
          orderInfo.getByText(/status|order.*status/i)
        ).toBeVisible();
      }

      // Order products section
      const orderProducts = page.locator(".section.products");

      if (await orderProducts.isVisible()) {
        // Should have product name
        await expect(orderProducts.locator(".a-left.name a")).toBeVisible();

        // Should have quantity
        await expect(
          orderProducts.locator(".a-center.quantity").last()
        ).toBeVisible();

        // Should have price
        await expect(orderProducts.locator(".a-right.total")).toBeVisible();
      }

      // Shipping info
      const shippingInfo = page.locator(
        '.shipping-info, [data-testid="shipping-info"]'
      );
      if (await shippingInfo.isVisible()) {
        await expect(shippingInfo).toBeVisible();
      }

      // Billing info
      const billingInfo = page.locator(
        '.billing-info, [data-testid="billing-info"]'
      );
      if (await billingInfo.isVisible()) {
        await expect(billingInfo).toBeVisible();
      }

      // Order totals
      const orderTotals = page.locator(".cart-total-left .nobr").last();

      if (await orderTotals.isVisible()) {
        await expect(orderTotals).toHaveText("Order Total:");
      }
    } else {
      test.skip("No orders available to test details view");
    }
  });

  test("should track order status", async ({ page }) => {
    // Navigate to orders page
    await page.click(".header-links .account");
    await page.click(".list li a[href='/customer/orders']");

    // Locators for order history page
    const orderListItems = page.locator(".order-item");

    if ((await orderListItems.count()) > 0) {
      const firstOrder = orderListItems.first();
      const orderStatus = firstOrder
        .locator('.info li, [data-testid="order-status"]')
        .first();

      if (await orderStatus.isVisible()) {
        // Click to view detailed tracking
        const trackingLink = firstOrder.getByRole("link", {
          name: /track|tracking/i,
        });

        if (await trackingLink.isVisible()) {
          await trackingLink.click();

          // Verify tracking page
          const trackingInfo = page.locator(
            '.tracking-info, [data-testid="tracking-info"]'
          );
          if (await trackingInfo.isVisible()) {
            await expect(trackingInfo).toBeVisible();

            // Look for tracking stages
            const trackingStages = page.locator(
              '.tracking-stage, .status-stage, [data-testid="tracking-stage"]'
            );
            if ((await trackingStages.count()) > 0) {
              const stageCount = await trackingStages.count();
              expect(stageCount).toBeGreaterThan(0);

              // Verify stages have timestamps and descriptions
              const firstStage = trackingStages.first();
              await expect(
                firstStage.locator(
                  '.stage-date, .timestamp, [data-testid="stage-date"]'
                )
              ).toBeVisible();
            }
          }
        } else {
          // If no tracking link, verify status is displayed correctly
          const currentStatus = await orderStatus.textContent();
          const status = currentStatus?.split(":").pop()?.trim() ?? "";
          console.log("Extracted status:", status);
          const statusText = status.toLowerCase();
          const validStatuses = [
            "pending",
            "processing",
            "shipped",
            "delivered",
            "cancelled",
            "completed",
          ];
          const hasValidStatus = validStatuses.some((status) =>
            statusText.includes(status)
          );
          expect(hasValidStatus).toBeTruthy();
        }
      }
    } else {
      test.skip("No orders available for status tracking test");
    }
  });

  test.only("should reorder previous items", async ({ page }) => {
    test.setTimeout(60000);

    const cartQuantity = await getAllCartItemQty(page);
    // Navigate to orders page
    await page.click(".header-links .account");
    await page.click(".list li a[href='/customer/orders']");

    // Locators for order history page
    const orderHistory = page.locator(
      '.order-list, .order-history, [data-testid="order-history"]'
    );
    const noOrdersMessage = page.getByText(
      /no orders|haven't placed|order history is empty/i
    );
    const orderListItems = page.locator(
      '.order-item, .order-row, [data-testid="order-item"]'
    );

    if ((await orderListItems.count()) > 0) {
      // Verify order list is displayed
      await expect(orderListItems.first()).toBeVisible();

      const orderCount = await orderListItems.count();
      expect(orderCount).toBeGreaterThan(0);

      const firstOrder = orderListItems.first();
      const viewDetailsButton = firstOrder.getByRole("button", {
        name: /details|view|show/i,
      });

      if (await viewDetailsButton.isVisible()) {
        await viewDetailsButton.click();
      }

      await page.waitForLoadState("networkidle");

      // Verify order details page
      await expect(
        page.getByRole("heading", {
          name: /Order information|order.*details|order.*#/i,
        })
      ).toBeVisible();

      // Order details section
      const orderInfo = page.locator(".page-body");

      if (await orderInfo.isVisible()) {
        const quantityCell = page.locator("td.a-center.quantity");
        const quantityText = await quantityCell.innerText();

        // Extract only digits and convert to number
        const reorderQuantity = parseInt(quantityText.replace(/\D/g, ""), 10);

        console.log("Quantity:", reorderQuantity); // 2 (number)

        const reorderButton = orderInfo.getByRole("button", {
          name: "Re-order",
        });
        await expect(reorderButton).toBeVisible();

        if (await reorderButton.isVisible()) {
          await reorderButton.click();

          // Check cart count increased
          const finalCartQuantity = await getAllCartItemQty(page);
          expect(finalCartQuantity).toBe(cartQuantity + reorderQuantity);
          await proceedToCheckout(page);

          const cartTotalPrice = await getCartTotal(page);
          await proceedToCheckout(page);
          const user = await fillBillingAddress(page, testData.registeredUser);
          await validateShippingAddress(page, testData.registeredUser);
          await selectShippingMethod(page, testData.shippingMethods[1]);
          await fillPaymentMethod(page, testData.paymentMethods[0]);
          await fillPaymentInfo(page, testData.paymentData);
          await confirmOrder(page, cartTotalPrice);
          await confirmationMessage(page);
        } else {
          test.skip("Reorder functionality not available");
        }
      }
    } else {
      test.skip("No item available for re-order");
    }
  });
});
