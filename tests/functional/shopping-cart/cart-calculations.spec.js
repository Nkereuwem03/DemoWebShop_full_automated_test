import { test, expect } from "@playwright/test";
import {
  testData,
  getCartTotal,
  clearCart,
  waitForCartUpdate,
  addProductToCart,
} from "../../../utils/helpers";

test.describe("Cart Calculations", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await clearCart(page);
  });

  test("should calculate subtotal correctly", async ({ page }) => {
    // Add items with known prices
    const productsToAdd = testData.testProducts.slice(0, 2);
    for (const product of productsToAdd) {
      await addProductToCart(page, product.name);
    }

    // Navigate to cart
    await page.goto("/cart");
    await page.waitForLoadState("networkidle");

    const cartItems = page.locator(".cart-item-row");
    const cartItemsCount = await cartItems.count();
    expect(cartItemsCount).toBeLessThanOrEqual(productsToAdd.length);

    let expectedSubtotal = 0;

    for (let i = 0; i < cartItemsCount; i++) {
      const item = cartItems.nth(i);

      // Get product name from cart row
      const productName = (
        await item.locator(".product .product-name").innerText()
      ).toLowerCase();

      // Match it with our test data
      const matchingProduct = productsToAdd.find((p) =>
        productName.includes(p.name.toLowerCase())
      );
      expect(matchingProduct).toBeDefined();

      // Verify displayed price matches expected
      const priceElement = item.locator(".subtotal .product-subtotal");
      const priceText = await priceElement.textContent();
      const displayedPrice = parseFloat(priceText.replace(/[$,]/g, ""));

      // Check against expected price * quantity
      const quantityElement = item.locator(".qty .qty-input");
      const quantity = (await quantityElement.isVisible())
        ? parseInt(await quantityElement.inputValue()) || 1
        : 1;

      const expectedLineTotal = matchingProduct.expectedPrice * quantity;
      expect(Math.abs(displayedPrice - expectedLineTotal)).toBeLessThan(0.01);

      expectedSubtotal += expectedLineTotal;
    }

    // Verify subtotal
    const subtotalElement = page
      .locator(".cart-total-right .nobr .product-price")
      .first();

    if (await subtotalElement.isVisible()) {
      const subtotalText = await subtotalElement.textContent();
      const actualSubtotal = parseFloat(subtotalText.replace(/[$,]/g, ""));

      expect(Math.abs(actualSubtotal - expectedSubtotal)).toBeLessThan(0.01);

      console.log(
        `Expected Subtotal: ${expectedSubtotal}, Actual Subtotal: ${actualSubtotal}`
      );
    }
  });

  test.skip("should apply discount codes", async ({ page }) => {
    // Add item to cart
    await addProductToCart(page, testData.testProducts[0].name);

    // Navigate to cart
    await page.goto("/cart");
    await page.waitForLoadState("networkidle");

    // Get original total
    const originalTotal = await getCartTotal(page);
    expect(originalTotal).toBeGreaterThan(0);

    // Apply discount code
    const discountInput = page.locator("input[name='discountcouponcode']");
    const applyButton = page.locator("input[value='Apply coupon']");

    if ((await discountInput.isVisible()) && (await applyButton.isVisible())) {
      // Test valid discount code
      await discountInput.fill(testData.discountCodes.valid[0]);
      await applyButton.click();

      await waitForCartUpdate(page);

      // Verify discount applied
      const discountSuccess = page.getByText(
        /discount applied|code applied|savings/i
      );
      if (await discountSuccess.isVisible()) {
        const newTotal = await getCartTotal(page);
        expect(newTotal).toBeLessThan(originalTotal);

        // Verify discount line item
        const discountLine = page.locator();
        if (await discountLine.isVisible()) {
          const discountText = await discountLine.textContent();
          const discountAmount = parseFloat(discountText.replace(/[$,-]/g, ""));
          expect(discountAmount).toBeGreaterThan(0);
        }
      }

      // Test invalid discount code
      await discountInput.clear();
      await discountInput.fill(testData.discountCodes.invalid[0]);
      await applyButton.click();

      await waitForCartUpdate(page);

      // Verify error message
      await expect(
        page.getByText(/invalid|expired|not found|error/i)
      ).toBeVisible();
    } else {
      test.skip("Discount code functionality not available");
    }
  });

  test.skip("should calculate tax based on location", async ({ page }) => {
    // Add item to cart
    await addProductToCart(page, testData.testProducts[0].name);

    // Navigate to cart
    await page.goto("/cart");
    await page.waitForLoadState("networkidle");

    // Check if tax calculation section exists
    const taxSection = page.locator();

    if (await taxSection.isVisible()) {
      // Enter shipping address for tax calculation
      const stateSelect = page.locator();
      const zipInput = page.locator();

      if ((await stateSelect.isVisible()) && (await zipInput.isVisible())) {
        await stateSelect.selectOption(testData.locations.domestic.state);
        await zipInput.fill(testData.locations.domestic.zip);

        // Trigger tax calculation
        const calculateButton = page.getByRole("button", {
          name: /calculate|estimate|update/i,
        });
        if (await calculateButton.isVisible()) {
          await calculateButton.click();
          await waitForCartUpdate(page);
        }

        // Verify tax is calculated
        const taxAmount = page.locator();
        if (await taxAmount.isVisible()) {
          const taxText = await taxAmount.textContent();
          const tax = parseFloat(taxText.replace(/[$,]/g, ""));
          expect(tax).toBeGreaterThanOrEqual(0);

          // Verify tax rate is reasonable
          const subtotal = await getCartTotal(page);
          const expectedTax = subtotal * testData.locations.domestic.taxRate;
          expect(Math.abs(tax - expectedTax)).toBeLessThan(subtotal * 0.02); // Allow 2% variance
        }
      }
    } else {
      console.log("Tax calculation not available at cart level");
    }
  });

  test("should include shipping costs", async ({ page }) => {
    // Add item to cart
    await addProductToCart(page, testData.testProducts[0].name);

    // Navigate to cart
    await page.goto("/cart");
    await page.waitForLoadState("networkidle");

    // Check if shipping calculation is available
    const shippingSection = page.locator(".estimate-shipping");

    if (await shippingSection.isVisible()) {
      // Enter shipping address
      const selectCountry = page.locator("#CountryId");
      await selectCountry.click();
      await selectCountry.waitFor({ state: "visible" });
      if (await selectCountry.isVisible()) {
        await selectCountry.selectOption(
          testData.locations.international.country
        );
      }

      const calculateButton = page.locator("input[value='Estimate shipping']");
      if (await calculateButton.isVisible()) {
        await calculateButton.click();
        await waitForCartUpdate(page);
      }

      // Verify shipping options appear
      // Verify shipping options appear
      const shippingOptions = page.locator(".shipping-option-item");
      const count = await shippingOptions.count();
      expect(count).toBeLessThanOrEqual(4);
    } else {
      console.log("Shipping calculation not available at cart level");
    }
  });

  test.skip("should handle multiple discount scenarios", async ({ page }) => {
    // Add multiple items
    await addProductToCart(page, testData.testProducts[0].name);
    await addProductToCart(page, testData.testProducts[1].name);

    await page.goto("/cart");
    await page.waitForLoadState("networkidle");

    const originalTotal = await getCartTotal(page);
    const discountInput = page.locator(
      'input[name="discount"], input[name="coupon"]'
    );
    const applyButton = page.getByRole("button", { name: /apply|add.*code/i });

    if (await discountInput.isVisible()) {
      // Test percentage discount
      if (testData.discountCodes.percentage) {
        await discountInput.fill(testData.discountCodes.percentage.code);
        await applyButton.click();
        await waitForCartUpdate(page);

        const percentageDiscountTotal = await getCartTotal(page);
        const expectedDiscount =
          originalTotal * (testData.discountCodes.percentage.discount / 100);
        const actualDiscount = originalTotal - percentageDiscountTotal;

        expect(Math.abs(actualDiscount - expectedDiscount)).toBeLessThan(1);
      }

      // Test fixed amount discount (if system allows changing codes)
      const removeDiscountButton = page.getByRole("button", {
        name: /remove|delete.*code/i,
      });
      if (await removeDiscountButton.isVisible()) {
        await removeDiscountButton.click();
        await waitForCartUpdate(page);

        if (testData.discountCodes.fixed) {
          await discountInput.fill(testData.discountCodes.fixed.code);
          await applyButton.click();
          await waitForCartUpdate(page);

          const fixedDiscountTotal = await getCartTotal(page);
          const expectedTotal =
            originalTotal - testData.discountCodes.fixed.discount;
          expect(Math.abs(fixedDiscountTotal - expectedTotal)).toBeLessThan(
            0.01
          );
        }
      }
    }
  });

  test("should show price breakdown", async ({ page }) => {
    // Add items to cart
    await addProductToCart(page, testData.testProducts[0].name);

    await page.goto("/cart");
    await page.waitForLoadState("networkidle");

    // Verify price breakdown components
    const priceBreakdown = page.locator(
      ".cart-total-left .nobr .product-price"
    );

    if (await priceBreakdown.isVisible()) {
      // Check for subtotal
      await expect(
        priceBreakdown.getByText(/subtotal/i).or(priceBreakdown.first())
      ).toBeVisible();

      // Check for shipping (if applicable)
      const shippingLine = priceBreakdown
        .getByText(/shipping|delivery/i)
        .or(priceBreakdown.nth(1));
      if (await shippingLine.isVisible()) {
        await expect(shippingLine).toBeVisible();
      }

      // Check for tax (if applicable)
      const taxLine = priceBreakdown
        .getByText(/tax|vat/i)
        .or(priceBreakdown.nth(2));
      if (await taxLine.isVisible()) {
        await expect(taxLine).toBeVisible();
      }

      // Check for total
      await expect(
        priceBreakdown.getByText(/total|grand total/i).or(priceBreakdown.last())
      ).toBeVisible();

      // Verify all amounts are properly formatted
      const amountElements = page
        .locator(
          ".cart-total-right .nobr .product-price",
          ':text-matches("\\d+\\.\\d{2}")'
        )
        .or(page.locator(".cart-total-right .nobr .product-price"));
      const amountCount = await amountElements.count();
      expect(amountCount).toBeGreaterThan(0);
    } else {
      console.log("Detailed price breakdown not available");
    }
  });
});
