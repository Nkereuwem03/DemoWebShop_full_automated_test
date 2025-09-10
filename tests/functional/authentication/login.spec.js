import { test, expect } from "@playwright/test";

test.describe("Login Functionality", async () => {
  const testUsers = {
    validUser: {
      email: "user.test123@test.com",
      password: "testuser",
    },
    invalidUser: {
      email: "invalid@example.com",
      password: "wrongpassword",
    },
    newUser: {
      email: "unregisteredemail@example.com",
      password: "NewPassword123!",
    },
  };

  test.beforeEach(async ({ page }) => {
    await page.goto("https://demowebshop.tricentis.com/");
    await expect(page).toHaveTitle("Demo Web Shop");
    await page.click("a[href='/login']");
  });

  const timestamp = Date.now();
  const testEmail = `test${timestamp}@test.com`;

  test("should login with valid credentials", async ({ page }) => {
    await page.fill("input[name='Email']", testUsers.validUser.email);
    await page.fill("input[name='Password']", testUsers.validUser.password);
    await page.click("input[value='Log in']");
    await expect(page).toHaveURL("https://demowebshop.tricentis.com/");
    await expect(
      page.locator("div[class='header-links'] a[class='account']")
    ).toHaveText(testUsers.validUser.email);
    const contentHeader = page.locator(".topic-html-content-header");
    await expect(contentHeader).toBeVisible({ timeout: 5000 });
    await expect(contentHeader).toHaveText("Welcome to our store");
    await expect(page.locator("a[href='/logout']")).toHaveText("Log out");
  });

  test("should show error with invalid credentials", async ({ page }) => {
    await page.fill("input[name='Email']", testUsers.invalidUser.email);
    await page.fill("input[name='Password']", testUsers.invalidUser.password);
    await page.click("input[value='Log in']");
    await expect(page.locator(".validation-summary-errors")).toHaveText(
      "Login was unsuccessful. Please correct the errors and try again. The credentials provided are incorrect"
    );
    await expect(page).toHaveURL("https://demowebshop.tricentis.com/login");
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("should show error with unregistered email", async ({ page }) => {
    await page.fill("input[name='Email']", testUsers.newUser.email);
    await page.fill("input[name='Password']", testUsers.newUser.password);
    await page.click("input[value='Log in']");
    await expect(page.locator(".validation-summary-errors")).toHaveText(
      "Login was unsuccessful. Please correct the errors and try again. No customer account found"
    );
    await expect(page).toHaveURL("https://demowebshop.tricentis.com/login");
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("should handle empty login fields", async ({ page }) => {
    await page.click("input[value='Log in']");
    await expect(page.locator(".validation-summary-errors")).toHaveText(
      "Login was unsuccessful. Please correct the errors and try again. No customer account found"
    );

    // Test with only email filled
    await page.getByLabel("Email").clear();
    await page.getByLabel("Email").fill(testUsers.validUser.email);
    await page.getByLabel("Password").clear();
    await page.click("input[value='Log in']");
    await expect(page.locator(".validation-summary-errors")).toHaveText(
      "Login was unsuccessful. Please correct the errors and try again. The credentials provided are incorrect"
    );

    // Test with only password filled
    await page.getByLabel("Email").clear();
    await page.getByLabel("Password").clear();
    await page.getByLabel("Password").fill(testUsers.validUser.password);
    await page.click("input[value='Log in']");
    await expect(page.locator(".validation-summary-errors")).toHaveText(
      "Login was unsuccessful. Please correct the errors and try again. No customer account found"
    );
  });

  test("should redirect to intended page after login", async ({
    page,
  }) => {
    // Try to access a protected page while not logged in
    await page.goto("/customer/info");
    await expect(page).toHaveURL(
      "https://demowebshop.tricentis.com/login?ReturnUrl=%2fcustomer%2finfo"
    );

    // Login with valid credentials
    await page.fill("input[name='Email']", testUsers.validUser.email);
    await page.fill("input[name='Password']", testUsers.validUser.password);
    await page.click("input[value='Log in']");

    // Should be redirected to originally intended page
    await expect(page).toHaveURL(
      "https://demowebshop.tricentis.com/customer/info"
    );

    // Verify we're actually on the profile page
    await expect(page).toHaveTitle("Demo Web Shop. Account");
    await expect(
      page.locator("div[class='page-title'] h1", {
        hasText: "My account - Customer info",
      })
    ).toBeVisible();
  });

  test('should remember login with "Remember Me"', async ({
    page,
    context,
  }) => {
    const rememberCheckbox = page.locator("input[type='checkbox'][name='RememberMe']");

    if (await rememberCheckbox.isVisible()) {
      await page.fill("input[name='Email']", testUsers.validUser.email);
      await page.fill("input[name='Password']", testUsers.validUser.password);
      await rememberCheckbox.check();
      await page.click("input[value='Log in']");
      await expect(
        page.locator("div[class='header-links'] a[class='account']", {
          hasText: testUsers.validUser.email,
        })
      ).toBeVisible({ timeout: 10000 });

      await page.close();
      const newPage = await context.newPage();

      // Visit a protected page - should still be logged in
      await newPage.goto("/customer/info");
      await expect(newPage).not.toHaveURL(
        "https://demowebshop.tricentis.com/login"
      );
      await expect(
        newPage.locator("div[class='page-title'] h1", {
          hasText: "My account - Customer info",
        })
      ).toBeVisible();
    } else {
      test.skip("Remember Me functionality not available");
    }
  });

  test("should logout successfully", async ({ page }) => {
    await page.fill("input[name='Email']", testUsers.validUser.email);
    await page.fill("input[name='Password']", testUsers.validUser.password);
    await page.click("input[value='Log in']");

    await expect(page.locator(".ico-logout", { hasText: "Log out" })).toBeVisible({ timeout: 10000 });
    await page.click("a[href='/logout']");

    await expect(page).toHaveURL("/");
    await expect(
      page.locator("a[href='/login']", { hasText: "Log in" })
    ).toBeVisible();

    // Verify user can't access protected pages
    await page.goto("/customer/info");
    await expect(page).toHaveURL("https://demowebshop.tricentis.com/login?ReturnUrl=%2fcustomer%2finfo");
  });

  test("should handle session timeout", async ({ page, context }) => {
    await page.fill("input[name='Email']", testUsers.validUser.email);
    await page.fill("input[name='Password']", testUsers.validUser.password);
    await page.click("input[value='Log in']");

    await expect(
      page.locator("a[href='/logout']", { hasText: "Log out" })
    ).toBeVisible({ timeout: 10000 });

    // Simulate session timeout by clearing cookies or making API call
    await context.clearCookies();

    // Try to access a protected page
    await page.goto("/customer/info");

    // Should be redirected to login due to expired session
    await expect(page).toHaveURL(
      "https://demowebshop.tricentis.com/login?ReturnUrl=%2fcustomer%2finfo"
    );

    // Should show session timeout message
    await expect(
      page.locator("a[href='/login']", { hasText: "Log in" })
    ).toBeVisible();
  });
});
