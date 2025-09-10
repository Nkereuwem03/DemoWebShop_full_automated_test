import { test, expect } from "@playwright/test";

test.describe("Registration Functionality", () => {
  const testUsers = {
    newUser: {
      firstName: "Jane",
      lastName: "Smith",
      email: `new_${Date.now()}@example.com`,
      password: "janesmith123",
    },
  };

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Demo Web Shop");
    await page.click("a[href='/register']");
  });

  test("should register new user with valid data", async ({ page }) => {
    await page.locator("#gender-male").check();
    await page.fill("#FirstName", testUsers.newUser.firstName);
    await page.fill("#LastName", testUsers.newUser.lastName);
    await page.fill("#Email", testUsers.newUser.email);
    await page.fill("#Password", testUsers.newUser.password);

    // Handle confirm password field if present
    const confirmPasswordField = page.locator("#ConfirmPassword");
    if (await confirmPasswordField.isVisible()) {
      await confirmPasswordField.fill(testUsers.newUser.password);
    }

    await page.click("#register-button");

    await expect(
      page.locator(".result", { hasText: "Your registration completed" })
    ).toBeVisible({ timeout: 15000 });

    // Should redirect to registration confirmation page
    await expect(page).toHaveURL(
      "https://demowebshop.tricentis.com/registerresult/1"
    );
  });

  test("should validate email format", async ({ page }) => {
    const invalidEmails = [
      "notanemail",
      "missing@",
      "@domain.com",
      "spaces in@email.com",
      "double@@domain.com",
    ];

    for (const invalidEmail of invalidEmails) {
      await test.step(`Test invalid email: ${invalidEmail}`, async () => {
        const emailField = page.getByLabel("Email");
        await emailField.clear();
        await emailField.fill(invalidEmail);

        await emailField.blur();

        // Check for email validation error
        await expect(page.getByText("Wrong email")).toBeVisible();
      });
    }
  });

  test("should enforce password requirements", async ({ page }) => {
    const weakPasswords = [
      {
        error: "short",
        message: "The password should have at least 6 characters.",
      },
      // {
      //   error: "nouppercase",
      //   message: "The password should have at least one uppercase letter.",
      // },
      // {
      //   error: "nolowercase",
      //   message: "The password should have at least one lowercase letter.",
      // },
      // {
      //   error: "nonumber",
      //   message: "The password should have at least one number.",
      // },
      // {
      //   error: "nospecial",
      //   message: "The password should have at least one special character.",
      // },
      // { error: "common", message: "The password is too common." },
    ];

    for (const weakPassword of weakPasswords) {
      await test.step(`Test weak password: ${weakPassword.error}`, async () => {
        const passwordField = page.locator("#Password");
        await passwordField.clear();
        await passwordField.fill(weakPassword.error);
        await passwordField.blur();

        // Check for password validation error
        await expect(page.getByText(weakPassword.message)).toBeVisible();
      });
    }
  });

  test("should prevent duplicate email registration", async ({ page }) => {
    const email = `first.last.${Date.now()}@mail.com`;
    for (let i = 0; i < 2; i++) {
      await page.locator("#gender-male").check();
      await page.fill("#FirstName", testUsers.newUser.firstName);
      await page.fill("#LastName", testUsers.newUser.lastName);
      await page.fill("#Email", email);
      await page.fill("#Password", testUsers.newUser.password);

      const confirmPasswordField = page.locator("#ConfirmPassword");
      if (await confirmPasswordField.isVisible()) {
        await confirmPasswordField.fill(testUsers.newUser.password);
      }

      await page.click("#register-button");

      if (i === 0) {
        await expect(
          page.locator(".result", { hasText: "Your registration completed" })
        ).toBeVisible({ timeout: 15000 });
        await expect(page).toHaveURL(
          "https://demowebshop.tricentis.com/registerresult/1"
        );
        await page.click("a[href='/logout']");
        await page.click("a[href='/register']");
      } else {
        await expect(
          page.getByText("The specified email already exists")
        ).toBeVisible();
        await expect(page).toHaveURL("/register");
      }
    }
  });

  // test.skip("should send confirmation email", async ({ page, request }) => {
  // });

  // test.skip("should activate account via email link", async ({ page, request }) => {
  // });
});
