import { test, expect } from "@playwright/test";

test.describe("Password Reset Functionality", () => {
  const testUsers = {
    validUser: {
      email: "user.test123@test.com",
      password: "testuser",
    },
  };

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Demo Web Shop");
    await page.click("a[href='/login']");
    await page.click("a[href='/passwordrecovery']");
  });

  test("should send password reset email", async ({ page, request }) => {
    await page.getByLabel("Your email address").fill(testUsers.validUser.email);
    await page.click("input[value='Recover']");
    await expect(page).toHaveURL(
      "https://demowebshop.tricentis.com/passwordrecovery"
    );
    await expect(
      page.getByText("Email with instructions has been sent to you.")
    ).toBeVisible({
      timeout: 10000,
    });
  });

  // test("should reset password with valid token", async ({ page }) => { })

  // test("should reject expired reset tokens", async ({ page }) => { });

  // test("should validate new password requirements", async ({ page }) => { });

  test.only("should handle non-existent email for password reset", async ({
    page,
  }) => {
    await page.getByLabel("Your email address").fill("abc@abc.com");
    await page.click("input[value='Recover']");
    await expect(page).toHaveURL(
      "https://demowebshop.tricentis.com/passwordrecovery"
    );

    // Should either show generic success message (security) or specific error
    await expect(page.getByText("Email not found.")).toBeVisible({
      timeout: 10000,
    });

    // For security reasons, many apps show success message even for invalid emails
    // to prevent email enumeration attacks
  });
});
