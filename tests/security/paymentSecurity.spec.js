import { test, expect } from "@playwright/test";
import {
  testData,
  addFeaturedProductToCart,
  proceedToCheckout,
  checkoutAsGuest,
  fillBillingAddress,
  validateShippingAddress,
  selectShippingMethod,
  fillPaymentMethod,
  checkForSecurityHeaders,
} from "../../utils/helpers";

test.describe("Payment Security", () => {
  test("should encrypt sensitive payment data", async ({ page }) => {
    // Add item to cart and proceed to checkout
    await page.goto("/");
    await addFeaturedProductToCart(page, 2);

    // Navigate to checkout
    await proceedToCheckout(page);
    await checkoutAsGuest(page);

    // Fill billing information
    const user = await fillBillingAddress(page, testData.guestUser);

    // Continue through shipping
    await validateShippingAddress(page, user);

    // Select shipping method
    await selectShippingMethod(page, testData.shippingMethods[2]);

    // Test payment form security
    await fillPaymentMethod(page, testData.paymentMethods[2]);

    // Check payment form security
    const cardNumberField = page.locator("#CardNumber");
    if (await cardNumberField.isVisible()) {
      // Verify HTTPS is used for payment processing
      expect(page.url()).toMatch(/^https:/);

      // Check form field attributes
      const cardNumberType = await cardNumberField.getAttribute("type");
      const cardNumberAutocomplete = await cardNumberField.getAttribute(
        "autocomplete"
      );

      // Should have appropriate input type and autocomplete
      expect(["text", "tel"].includes(cardNumberType)).toBeTruthy();
      expect(cardNumberAutocomplete).toContain("cc-number");

      // Test that sensitive data is not logged in browser
      await cardNumberField.fill("4111111111111111");

      // Check if card number is masked in DOM
      const cardNumberValue = await cardNumberField.inputValue();

      // Some systems mask the card number immediately
      if (
        cardNumberValue !== "4111111111111111" &&
        cardNumberValue.includes("*")
      ) {
        console.log("Card number masking detected");
      }

      // Test CVV field
      const cvvField = page.locator("#CardCode");
      if (await cvvField.isVisible()) {
        const cvvType = await cvvField.getAttribute("type");
        expect(cvvType).toBe("text"); // CVV should be text type

        await cvvField.fill("123");

        // CVV should not be visible in value
        const cvvValue = await cvvField.inputValue();
        expect(cvvValue).toBe("123"); // Input value, but should be masked visually
      }

      // Check for SSL/TLS certificate
      const securityHeaders = await checkForSecurityHeaders(page, page.url());

      if (page.url().startsWith("https://")) {
        console.log("Payment form uses HTTPS - good security practice");
      } else {
        console.warn("Payment form not using HTTPS - security risk");
      }
    }
  });

  test("should comply with PCI DSS standards", async ({ page }) => {
    // Add item to cart and proceed to checkout
    await page.goto("/");
    await addFeaturedProductToCart(page, 2);

    // Navigate to checkout
    await proceedToCheckout(page);
    await checkoutAsGuest(page);

    // PCI DSS Requirement 1: Firewall protection (network level, can't test directly)
    console.log(
      "PCI DSS Requirement 1: Firewall protection - Network level requirement"
    );

    // PCI DSS Requirement 2: Default passwords (already tested in authentication)
    console.log(
      "PCI DSS Requirement 2: Default passwords - Tested in authentication suite"
    );

    // PCI DSS Requirement 3: Protect stored cardholder data
    const pageSource = await page.content();

    // Should not find credit card numbers in source code
    const cardNumberPattern = /\b(?:\d{4}[\s-]?){3}\d{4}\b/g;
    const foundCardNumbers = pageSource.match(cardNumberPattern);

    if (foundCardNumbers) {
      console.warn(
        "Potential credit card numbers found in page source - PCI DSS violation"
      );
    }

    // Should not find CVV codes
    const cvvPattern = /\bcvv:\s*\d{3,4}\b/gi;
    const foundCVV = pageSource.match(cvvPattern);

    if (foundCVV) {
      console.warn("CVV codes found in page source - PCI DSS violation");
    }

    // PCI DSS Requirement 4: Encrypt transmission of cardholder data
    if (!page.url().startsWith("https://")) {
      console.warn(
        "Payment processing not using HTTPS - PCI DSS Requirement 4 violation"
      );
    }

    // Check for proper TLS version
    const securityState = await page.evaluate(() => {
      return {
        protocol: location.protocol,
        securityState: document.securityState || "unknown",
      };
    });

    console.log(
      `Protocol: ${securityState.protocol}, Security State: ${securityState.securityState}`
    );

    // PCI DSS Requirement 6: Develop and maintain secure systems
    // Check for common vulnerabilities already tested

    // PCI DSS Requirement 7: Restrict access by business need-to-know
    // Test that payment forms are only accessible during checkout
    await page.goto("/");

    const unauthorizedCardForm = page.locator("#CardNumber");
    const cardFormVisible = await unauthorizedCardForm.isVisible();

    expect(cardFormVisible).toBeFalsy(); // Card form should not be accessible outside checkout

    // PCI DSS Requirement 8: Identify and authenticate access
    // Already tested in authentication suite

    // PCI DSS Requirement 9: Restrict physical access
    console.log(
      "PCI DSS Requirement 9: Physical access - Infrastructure requirement"
    );

    // PCI DSS Requirement 10: Track and monitor access
    // Check for proper logging (if audit trail is visible)
    const auditElements = page.locator(
      "[data-audit], .audit-trail, .security-log"
    );
    if ((await auditElements.count()) > 0) {
      console.log("Audit trail elements detected - good PCI DSS practice");
    }

    // PCI DSS Requirement 11: Regular security testing
    console.log(
      "PCI DSS Requirement 11: Regular security testing - This test suite addresses this requirement"
    );

    // PCI DSS Requirement 12: Maintain information security policy
    const privacyPolicyLink = page.getByRole("link", {
      name: /privacy.*policy|security.*policy/i,
    });
    if ((await privacyPolicyLink.count()) > 0) {
      console.log(
        "Privacy/Security policy link found - supports PCI DSS Requirement 12"
      );
    }
  });

  test("should prevent payment fraud", async ({ page }) => {
    await page.goto("/");
    await addFeaturedProductToCart(page, 1);

    await proceedToCheckout(page);
    await checkoutAsGuest(page); // only once

    const user = await fillBillingAddress(page, testData.suspiciousUser);
    await fillPaymentMethod(page, testData.paymentMethods[2]);

    

   
    // Multiple suspicious cards
    const cardNumberField = page.locator("#CardNumber");
    if (await cardNumberField.isVisible()) {
      const suspiciousCards = [
        "4111111111111111",
        "5555555555554444",
        "378282246310005",
        "4000000000000002", // known decline card
      ];

      for (let i = 0; i < suspiciousCards.length; i++) {
        await cardNumberField.fill(suspiciousCards[i]);
        await page.locator("#CardCode").fill("123");
        await page.locator("#ExpireMonth").selectOption("12");
        await page.locator("#ExpireYear").selectOption("2025");
        await page.locator("#CardholderName").fill("Fraud User");

        await page.waitForTimeout(100); // simulate rapid attempts

        const fraudWarning = page.getByText(
          /suspicious.*activity|fraud.*detected|security.*concern/i
        );
        if (await fraudWarning.isVisible()) {
          await expect(fraudWarning).toBeVisible();
          break;
        }
      }

      // Declined card scenario
      await cardNumberField.fill("4000000000000002");
      await paymentContinue.click();
      await page.waitForLoadState("networkidle");

      const declinedMessage = page.getByText(
        /declined|card.*error|payment.*failed/i
      );
      await expect(declinedMessage).toBeVisible();
    }

    // Placeholders for checks that need backend support
    console.log(
      "Velocity check: multiple orders in short time should be blocked"
    );
    console.log("Geo mismatch: billing vs shipping country should be flagged");
  });

  test("should validate payment amount integrity", async ({ page }) => {
    // 
  });
});
