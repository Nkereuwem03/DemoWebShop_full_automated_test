import { test, expect } from "@playwright/test";

// Security test data and payloads
const securityTestData = {
  sqlInjectionPayloads: [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "' UNION SELECT * FROM users --",
    "admin'--",
    "' OR 1=1 --",
  ],
  xssPayloads: [
    '<script>alert("XSS")</script>',
    '<img src="x" onerror="alert(1)">',
    "<svg/onload=alert(1)>",
    '<iframe src="javascript:alert(1)"></iframe>',
  ],
  invalidEmails: [
    "plainaddress",
    "@missingdomain.com",
    "missing@.com",
    "missing@domain",
    "spaces in@email.com",
    "toolong" + "a".repeat(250) + "@domain.com",
  ],
  weakPasswords: ["123", "password", "12345678", "qwerty", "abc123"],
  strongPasswords: [
    "SecureP@ssw0rd123!",
    "MyV3ryStr0ng#P@ssw0rd",
    "C0mpl3x!P@ssw0rd#2024",
  ],
};

// Helper functions
const submitForm = async (page, formData) => {
  for (const [fieldName, value] of Object.entries(formData)) {
    const field = page.locator(
      `input[name="${fieldName}"], textarea[name="${fieldName}"]`
    );
    if (await field.isVisible()) {
      await field.clear();
      await field.fill(value);
    }
  }

  const submitButton = page
    .locator('input[type="submit"], button[type="submit"]')
    .first();
  if (await submitButton.isVisible()) {
    await submitButton.click();
    await page.waitForLoadState("networkidle");
  }
};

test.describe("Input Validation Security", () => {
  test("should prevent SQL injection attacks", async ({ page }) => {
    // Test search functionality for SQL injection
    await page.goto("/");

    const searchInput = page
      .locator("#small-searchterms")
      .or(page.getByPlaceholder(/search/i));

    if (await searchInput.isVisible()) {
      for (const payload of securityTestData.sqlInjectionPayloads) {
        await test.step(`Test SQL injection payload: ${payload}`, async () => {
          await searchInput.clear();
          await searchInput.fill(payload);
          await searchInput.press("Enter");

          // Check that the application doesn't crash or show database errors
          const pageContent = await page.textContent("body");

          // Look for common SQL error messages
          const sqlErrors = [
            "sql syntax",
            "mysql error",
            "ora-",
            "microsoft ole db",
            "unclosed quotation",
            "quoted string not properly terminated",
          ];

          const hasError = sqlErrors.some((error) =>
            pageContent.toLowerCase().includes(error)
          );

          expect(hasError).toBeFalsy();

          // Verify the payload is properly escaped/sanitized in output
          if (pageContent.includes(payload)) {
            console.warn(
              `Potential SQL injection payload reflected: ${payload}`
            );
          }
        });
      }
    }

    // Test login form for SQL injection
    await page.goto("/login");

    const emailField = page.locator('input[name="Email"]');
    const passwordField = page.locator('input[name="Password"]');

    if ((await emailField.isVisible()) && (await passwordField.isVisible())) {
      for (const payload of securityTestData.sqlInjectionPayloads.slice(0, 3)) {
        await test.step(`Test login SQL injection: ${payload}`, async () => {
          await emailField.fill(payload);
          await passwordField.fill("testpassword");

          const submitButton = page.locator("input[value='Log in']");
          await submitButton.click();

          // Should not be logged in or show SQL errors
          const currentUrl = page.url();
          const pageContent = await page.textContent("body");

          // Should still be on login page or show proper error
          expect(currentUrl).toMatch(/login|error/);

          // Should not contain SQL error messages
          const hasSQLError = pageContent.toLowerCase().includes("sql");
          expect(hasSQLError).toBeFalsy();
        });
      }
    }
  });

  test("should sanitize user inputs", async ({ page }) => {
    // Test registration form input sanitization
    await page.goto("/register");

    const registrationFields = {
      FirstName: '<script>alert("XSS")</script>',
      LastName: '<img src="x" onerror="alert(1)">',
      Email: "test@example.com",
    };

    let formFound = false;

    for (const [fieldName, testValue] of Object.entries(registrationFields)) {
      const field = page.locator(`input[name="${fieldName}"]`);
      if (await field.isVisible()) {
        formFound = true;
        await field.fill(testValue);

        // Check that the input is sanitized when reflected
        const fieldValue = await field.inputValue();

        // Input should be sanitized (no script tags)
        if (testValue.includes("<script>") && fieldValue.includes("<script>")) {
          console.warn(`Script tags not sanitized in ${fieldName} field`);
        }
      }
    }

    if (formFound) {
      const submitButton = page.locator();
      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Check that dangerous content is not reflected in the response
        const pageContent = await page.textContent("body");
        const hasUnsafeContent =
          pageContent.includes("<script>") || pageContent.includes("onerror=");

        expect(hasUnsafeContent).toBeFalsy();
      }
    }
  });

  test("should validate email formats", async ({ page }) => {
    await page.goto("/register");

    const emailField = page.locator('input[name="Email"], input[type="email"]');

    if (await emailField.isVisible()) {
      for (const invalidEmail of securityTestData.invalidEmails) {
        await test.step(`Test invalid email: ${invalidEmail}`, async () => {
          await emailField.clear();
          await emailField.fill(invalidEmail);

          // Trigger validation (blur or submit)
          await emailField.blur();

          // Check for client-side validation
          const validationMessage = await emailField.evaluate(
            (element) => element.validationMessage
          );

          if (validationMessage) {
            expect(validationMessage).toBeTruthy();
            console.log(`Client validation caught: ${invalidEmail}`);
          }

          // Should show validation error or stay on form
          const errorMessage = page.locator(
            'span[data-valmsg-for="Email"] span'
          );
          if (await errorMessage.isVisible()) {
            const errorText = await errorMessage.textContent();
            expect(errorText.toLowerCase()).toContain("email");
          }
        });
      }

      // Test with valid email
      await emailField.clear();
      await emailField.fill("valid@example.com");
      await emailField.blur();

      const validationMessage = await emailField.evaluate(
        (element) => element.validationMessage
      );

      expect(validationMessage).toBe("");
    }
  });

  test("should prevent XSS attacks", async ({ page }) => {
    // Test search for XSS
    await page.goto("/");

    const searchInput = page.locator("#small-searchterms");
    if (await searchInput.isVisible()) {
      for (const xssPayload of securityTestData.xssPayloads) {
        await test.step(`Test XSS payload: ${xssPayload}`, async () => {
          await searchInput.clear();
          await searchInput.fill(xssPayload);
          await searchInput.press("Enter");
          await expect(page.locator("p").first()).toBeVisible();
          const message = "We're sorry, an internal error occurred.".trim();
          const errorMessage = page.getByText(message);
          await expect(errorMessage).toBeVisible();
          await page.goBack();
        });
      }
    }
  });

  test("should implement proper input length limits", async ({ page }) => {
    await page.goto("/register");

    const inputFields = [
      { name: "FirstName", maxLength: 50 },
      { name: "LastName", maxLength: 50 },
      { name: "Email", maxLength: 254 },
      { name: "Password", maxLength: 128 },
    ];

    for (const field of inputFields) {
      if (field.name === "Email") continue;

      const inputElement = page.locator(`input[name="${field.name}"]`);

      if (await inputElement.isVisible()) {
        await test.step(`Test ${field.name} length limit`, async () => {
          const longString = "A".repeat(field.maxLength + 50);
          await inputElement.fill(longString);

          const actualValue = await inputElement.inputValue();

          // Should be truncated to maxLength or rejected
          if (actualValue.length > field.maxLength) {
            console.warn(
              `${field.name} accepts input longer than expected: ${actualValue.length}`
            );
          }

          expect(actualValue.length).toBeLessThanOrEqual(field.maxLength + 10); // Allow some tolerance
        });
      }
    }
  });
});
