import { test, expect } from "@playwright/test";
import { testData } from "../../utils/helpers";

// Security test data and payloads
const securityTestData = {
  weakPasswords: ["123", "abcde", "12345", "ab123"],
  strongPasswords: [
    "SecureP@ssw0rd123!",
    "MyV3ryStr0ng#P@ssw0rd",
    "C0mpl3x!P@ssw0rd#2024",
  ],
};

const checkForSecurityHeaders = async (page, url) => {
  const response = await page.goto(url);
  const headers = response.headers();

  // const securityHeaders = {
  //   "x-frame-options": headers["x-frame-options"],
  //   "x-content-type-options": headers["x-content-type-options"],
  //   "x-xss-protection": headers["x-xss-protection"],
  //   "strict-transport-security": headers["strict-transport-security"],
  //   "content-security-policy": headers["content-security-policy"],
  // };

  // return securityHeaders;
  return headers
};

test.describe("Authentication Security", () => {
  test("should enforce strong password policies", async ({ page }) => {
    await page.goto("/register");

    const passwordField = page
      .locator('input[name="Password"], input[type="password"]')
      .first();
    const confirmPasswordField = page.locator('input[name="ConfirmPassword"]');

    if (await passwordField.isVisible()) {
      // Test weak passwords
      for (const weakPassword of securityTestData.weakPasswords) {
        await test.step(`Test weak password: ${weakPassword}`, async () => {
          await passwordField.clear();
          await passwordField.fill(weakPassword);

          if (await confirmPasswordField.isVisible()) {
            await confirmPasswordField.fill(weakPassword);
          }

          // Fill other required fields
          const emailField = page.locator('input[name="Email"]');
          if (await emailField.isVisible()) {
            await emailField.fill("test@example.com");
          }

          const firstNameField = page.locator('input[name="FirstName"]');
          if (await firstNameField.isVisible()) {
            await firstNameField.fill("Test");
          }

          const lastNameField = page.locator('input[name="LastName"]');
          if (await lastNameField.isVisible()) {
            await lastNameField.fill("User");
          }

          const submitButton = page.locator("#register-button");
          await submitButton.click();

          // Should show password strength error
          const errorMessages = page.locator(
            "span[data-valmsg-for='Password'] span"
          ); 
          let hasPasswordError = false;

          const errorCount = await errorMessages.count();
          for (let i = 0; i < errorCount; i++) {
            const errorText = await errorMessages.nth(i).textContent();
            if (errorText.toLowerCase().includes("password")) {
              hasPasswordError = true;
              break;
            }
          }

          if (!hasPasswordError) {
            console.warn(`Weak password accepted: ${weakPassword}`);
          }
        });
      }

      // Test strong password (should be accepted)
      const strongPassword = securityTestData.strongPasswords[0];
      await passwordField.clear();
      await passwordField.fill(strongPassword);

      if (await confirmPasswordField.isVisible()) {
        await confirmPasswordField.fill(strongPassword);
      }

      await passwordField.blur();

      // Should not show password strength error
      const passwordErrors = page.locator(
        "span[data-valmsg-for='Password'] span"
      );
      const errorCount = await passwordErrors.count();

      expect(errorCount).toBe(0);
    }
  });

  test("should implement proper session management", async ({
    page,
    context,
  }) => {
    // Test session timeout
    await page.goto("/login");

    const emailField = page.locator('input[name="Email"]');
    const passwordField = page.locator('input[name="Password"]');

    if (await emailField.isVisible()) {
      // Login with valid credentials (using existing test account)
      await emailField.fill(testData.registeredUser.loginEmail); // Common nopCommerce default
      await passwordField.fill(testData.registeredUser.password); // Common nopCommerce default

      const submitButton = page.locator("input[value='Log in']");
      await submitButton.click();

      // Check if login was successful
      const isLoggedIn =
        page.url().includes("/") ||
        (expect(page.locator("div[class='header-links'] a[class='account']").textContent()).toBe(testData.registeredUser.loginEmail));

      if (isLoggedIn) {
        // Test session security
        const cookies = await context.cookies();
        const sessionCookie = cookies.find(
          (cookie) =>
            cookie.name.toLowerCase().includes("session") ||
            cookie.name.toLowerCase().includes("auth") ||
            cookie.name === "Nop.customer"
        );

        expect(sessionCookie).toBeTruthy()

        if (sessionCookie) {
          // Verify session cookie security attributes
          expect(sessionCookie.httpOnly).toBeTruthy(); // Should be HttpOnly

          // if (page.url().startsWith("https://")) {
          //   expect(sessionCookie.secure).toBeTruthy(); // Should be Secure for HTTPS
          // }

          expect(sessionCookie.sameSite).toBeTruthy(); // Should have SameSite

          console.log(
            `Session cookie security: HttpOnly=${sessionCookie.httpOnly}, Secure=${sessionCookie.secure}, SameSite=${sessionCookie.sameSite}`
          );
        }

        // Test logout functionality
        const logoutLink = page.locator('a[href*="logout"], .logout');
        if (await logoutLink.isVisible()) {
          await logoutLink.click();

          // Verify session is cleared
          const postLogoutCookies = await context.cookies();
          const remainingSessionCookie = postLogoutCookies.find(
            (cookie) => cookie.name === sessionCookie?.name
          );

          if (remainingSessionCookie) {
            // Cookie should be expired or cleared
            expect(remainingSessionCookie.value).toBe("");
          }
        }
      }
    }

    // Test concurrent session handling
    const newContext = await page.context().browser().newContext();
    const newPage = await newContext.newPage();

    await newPage.goto("/login");

    // Attempt same login in different context
    const newEmailField = newPage.locator('input[name="Email"]');
    if (await newEmailField.isVisible()) {
      await newEmailField.fill(testData.registeredUser.loginEmail);
      await newPage.locator('input[name="Password"]').fill(testData.registeredUser.password);
      await newPage.locator("input[value='Log in']").click();

      // Both sessions should be handled appropriately
      console.log("Concurrent session test completed");
    }

    await newContext.close();
  });

  test("should prevent brute force attacks", async ({ page }) => {
    await page.goto("/login");

    const emailField = page.locator('input[name="Email"]');
    const passwordField = page.locator('input[name="Password"]');

    if (await emailField.isVisible()) {
      const testEmail = "bruteforce@test.com";
      const attempts = 5; // Reduced for testing
      let attemptTimes = [];

      for (let i = 0; i < attempts; i++) {
        await test.step(`Brute force attempt ${i + 1}`, async () => {
          await emailField.clear();
          await emailField.fill(testEmail);
          await passwordField.clear();
          await passwordField.fill(`wrongpassword${i}`);

          const startTime = Date.now();
          const submitButton = page.locator("input[value='Log in']");
          await submitButton.click();
          const endTime = Date.now();

          attemptTimes.push(endTime - startTime);

          // Check for rate limiting or CAPTCHA
          const captcha = page.locator(
            '.captcha, [data-captcha], img[src*="captcha"]'
          );
          const rateLimitMessage = page.getByText(
            /too many attempts|rate limit|try again later/i
          );
          const accountLocked = page.getByText(
            /account.*locked|temporarily.*disabled/i
          );

          if (await captcha.isVisible()) {
            console.log(`CAPTCHA appeared after attempt ${i + 1}`);
            return; // Stop testing if CAPTCHA appears
          }

          if (await rateLimitMessage.isVisible()) {
            console.log(`Rate limiting detected after attempt ${i + 1}`);
            return; // Stop if rate limited
          }

          if (await accountLocked.isVisible()) {
            console.log(`Account lockout detected after attempt ${i + 1}`);
            return; // Stop if account locked
          }
        });
      }

      // Check if response times increase (rate limiting)
      if (attemptTimes.length > 2) {
        const avgFirstHalf =
          attemptTimes.slice(0, 2).reduce((a, b) => a + b) / 2;
        const avgSecondHalf =
          attemptTimes.slice(-2).reduce((a, b) => a + b) / 2;

        if (avgSecondHalf > avgFirstHalf * 1.5) {
          console.log("Response time increase suggests rate limiting");
        } else {
          console.warn("No obvious brute force protection detected");
        }
      }
    }
  });

  test("should secure password reset process", async ({ page }) => {
    await page.goto("/passwordrecovery");

    const emailField = page.locator('input[name="Email"], input[type="email"]');

    if (await emailField.isVisible()) {
      // Test with valid email
      await emailField.fill(testData.registeredUser.loginEmail);

      const submitButton = page.locator("input[value='Recover']");
      await submitButton.click();

      // Should show generic success message (don't reveal if email exists)
      const successMessage = page.getByText(
        /email.*sent|check.*email|instructions.*sent|Email with instructions has been sent to you./i
      );
      const errorMessage = page.getByText(/email.*not.*found.|invalid.*email/i);

      if (await errorMessage.isVisible()) {
        console.warn(
          "Password reset reveals email existence - information disclosure"
        );
      }

      // Test with non-existent email
      await page.goto("/passwordrecovery");
      await emailField.fill("nonexistent@example.com");
      await submitButton.click();

      // Should show same generic message
      const nonExistentResponse = await page.textContent("body");

      // Response should be similar regardless of email validity
      if (await page.getByText(/email.*not.*found/i).isVisible()) {
        console.warn(
          "Password reset process reveals whether emails exist in system"
        );
      }

      // Test rate limiting on password reset
      const resetAttempts = 3;
      for (let i = 0; i < resetAttempts; i++) {
        await emailField.fill(`test${i}@example.com`);
        await submitButton.click();
        await page.waitForTimeout(500);

        const rateLimitWarning = page.getByText(
          /too many.*requests|rate.*limit/i
        );
        if (await rateLimitWarning.isVisible()) {
          console.log(
            `Password reset rate limiting detected after ${i + 1} attempts`
          );
          break;
        }
      }
    }

    // Test password reset token security (if reset URL is available)
    const resetUrl =
      "/passwordrecovery/confirm?token=test123&email=test@example.com";
    await page.goto(resetUrl);

    const resetForm = page.locator("form");
    if (await resetForm.isVisible()) {
      // Test weak password in reset
      const newPasswordField = page.locator('input[name="NewPassword"]');
      const confirmPasswordField = page.locator(
        'input[name="ConfirmPassword"]'
      );

      if (await newPasswordField.isVisible()) {
        await newPasswordField.fill("123");
        if (await confirmPasswordField.isVisible()) {
          await confirmPasswordField.fill("123");
        }

        const resetSubmitButton = page.locator('input[type="submit"]');
        await resetSubmitButton.click();
        await page.waitForTimeout(1000);

        // Should reject weak password
        const passwordError = page.locator(".field-validation-error");
        const hasPasswordValidation = (await passwordError.count()) > 0;

        if (!hasPasswordValidation) {
          console.warn("Password reset accepts weak passwords");
        }
      }
    }
  });

  test.only("should implement secure authentication headers", async ({
    page,
  }) => {
    const securityHeaders = await checkForSecurityHeaders(page, "/login");

    console.log("Security headers analysis:");
    console.log(JSON.stringify(securityHeaders, null, 2));

    // Check for important security headers
    if (!securityHeaders["x-frame-options"]) {
      console.warn(
        "Missing X-Frame-Options header - clickjacking vulnerability"
      );
    }

    if (!securityHeaders["x-content-type-options"]) {
      console.warn(
        "Missing X-Content-Type-Options header - MIME type sniffing vulnerability"
      );
    }

    if (!securityHeaders["x-xss-protection"]) {
      console.warn("Missing X-XSS-Protection header");
    }

    if (
      page.url().startsWith("https://") &&
      !securityHeaders["strict-transport-security"]
    ) {
      console.warn("Missing Strict-Transport-Security header for HTTPS site");
    }

    if (!securityHeaders["content-security-policy"]) {
      console.warn("Missing Content-Security-Policy header - XSS protection");
    }

    // Verify secure cookie attributes
    const response = await page.goto("/login");
    const cookieHeader = response.headers()["set-cookie"];

    if (cookieHeader) {
      const hasHttpOnly = cookieHeader.includes("HttpOnly");
      const hasSecure =
        cookieHeader.includes("Secure") || !page.url().startsWith("https://");
      const hasSameSite = cookieHeader.includes("SameSite");

      if (!hasHttpOnly) {
        console.warn("Session cookies missing HttpOnly attribute");
      }

      if (!hasSecure && page.url().startsWith("https://")) {
        console.warn("Session cookies missing Secure attribute for HTTPS");
      }

      if (!hasSameSite) {
        console.warn("Session cookies missing SameSite attribute");
      }
    }
  });
});
