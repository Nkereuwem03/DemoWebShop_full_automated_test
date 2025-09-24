import { test, expect } from "@playwright/test";
import { login, testData } from "../../../utils/helpers";

// Test data setup
// const testData = {
//   existingUser: {
//     email: "testuser@example.com",
//     password: "Password123!",
//     firstName: "John",
//     lastName: "Doe",
//     phone: "555-123-4567",
//     dateOfBirth: "01/15/1985",
//   },


//   emailPreferences: {
//     newsletter: true,
//     promotions: false,
//     orderUpdates: true,
//     productReviews: false,
//   },
//   testProducts: [
//     { name: "laptop", expectedPrice: 1590 },
//     { name: "book", expectedPrice: 10 },
//     { name: "shirt", expectedPrice: 25 },
//   ],
// };

// Helper functions
const addProductToCart = async (page, productName) => {
  const searchInput = page
    .locator("#small-searchterms")
    .or(page.getByPlaceholder(/search/i));

  if (await searchInput.isVisible()) {
    await searchInput.fill(productName);
    await searchInput.press("Enter");
    await page.waitForLoadState("networkidle");
  }

  const productCard = page
    .locator('.product-item, [data-testid="product-card"]')
    .first();
  await productCard.click();

  const addToCartButton = page.locator("input.button-1.add-to-cart-button");
  await addToCartButton.click();

  await expect(
    page.locator(".bar-notification").or(page.getByText(/added to cart/i))
  ).toBeVisible({ timeout: 10000 });
};

const navigateToAccountSection = async (page, section = "") => {
  // const accountLink = await page.click(".header-links .account");
  const accountLink = page.getByRole("link", { name: /account|my account/i });
  await accountLink.click();
  await page.waitForLoadState("networkidle");

  if (section) {
    const sectionLink = page.getByRole("link", {
      name: new RegExp(section, "i"),
    });
    if (await sectionLink.isVisible()) {
      await sectionLink.click();
      await page.waitForLoadState("networkidle");
    }
  }
};

test.describe("Profile Management", () => {
  test.beforeEach(async ({ page }) => {
    await login(page, testData.registeredUser);
  });

  test("should update profile information", async ({ page }) => {
    await page.click(".header-links .account");
    await page
      .locator(".listbox .list li a", { hasText: /Customer info/i })
      .click();
    expect(page.url()).toContain("/customer/info");
    await page.waitForLoadState("networkidle");

    // Verify current profile information is loaded
    const firstNameInput = page.locator("#FirstName");
    const lastNameInput = page.locator("#LastName");
    const emailInput = page.locator("#Email");

    if (await firstNameInput.isVisible()) {
      const currentFirstName = await firstNameInput.inputValue();
      expect(currentFirstName).toBeTruthy();

      // Update profile information
      await firstNameInput.clear();
      await firstNameInput.fill(testData.updatedProfile.firstName);
    }

    if (await lastNameInput.isVisible()) {
      await lastNameInput.clear();
      await lastNameInput.fill(testData.updatedProfile.lastName);
    }

    // Update phone number if field exists
    if (await emailInput.isVisible()) {
      await emailInput.clear();
      await emailInput.fill(testData.updatedProfile.email);
    }

    // Handle gender selection if available
    const genderSelect = page.locator(".gender .forcheckbox", {
      hasText: testData.updatedProfile.gender
    });
    if (await genderSelect.isVisible()) {
      await genderSelect.click()
    }

    // Save changes
    const saveButton = page.getByRole("button", { name: /save|update/i });
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Verify update action
    await expect(page.locator(".header-links li .account")).toHaveText(
      testData.updatedProfile.email
    );

    // Refresh page and verify changes persisted
    await page.reload();
    await page.waitForLoadState("networkidle");

    if (await firstNameInput.isVisible()) {
      const updatedFirstName = await firstNameInput.inputValue();
      expect(updatedFirstName).toBe(testData.updatedProfile.firstName);
    }

    if (await lastNameInput.isVisible()) {
      const updatedLastName = await lastNameInput.inputValue();
      expect(updatedLastName).toBe(testData.updatedProfile.lastName);
    }
  });

  test.only("should change password", async ({ page }) => {
    await page.click(".header-links .account");
    await page
      .locator(".listbox .list li a", { hasText: /Change password/i })
      .click();
    expect(page.url()).toContain("/customer/changepassword");
    await page.waitForLoadState("networkidle");

    // Fill password change form
    const currentPasswordInput = page.locator("#OldPassword");
    const newPasswordInput = page.locator("#NewPassword");
    const confirmPasswordInput = page.locator("#ConfirmNewPassword");

    if (await currentPasswordInput.isVisible()) {
      await currentPasswordInput.fill(testData.newPassword.current);
      await newPasswordInput.fill(testData.newPassword.new);
      await confirmPasswordInput.fill(testData.newPassword.confirm);

      // Submit password change
      const changePasswordButton = page.getByRole("button", {
        name: /change password|update password/i,
      });
      await changePasswordButton.click();

      // Verify success message
      await expect(
        page.getByText(/password.*changed|password.*updated|success/i)
      ).toBeVisible({ timeout: 10000 });

      // Test login with new password
      await page.goto("/logout");
      await page.waitForLoadState("networkidle");

      await page.goto("/login");
      await page
        .getByLabel(/email|username/i)
        .fill(testData.registeredUser.loginEmail);
      await page.getByLabel(/password/i).fill(testData.newPassword.new);
      await page.getByRole("button", { name: /login|log in|sign in/i }).click();
      
      // Should successfully login with new password
      await expect(
        page.getByRole("link", { name: /account|logout/i })
      ).toBeVisible({ timeout: 10000 });

      // Change password back for subsequent tests
      await navigateToAccountSection(page, "Change password");

      if (await currentPasswordInput.isVisible()) {
        await currentPasswordInput.fill(testData.newPassword.new);
        await newPasswordInput.fill(testData.newPassword.current);
        await confirmPasswordInput.fill(testData.newPassword.current);
        await changePasswordButton.click();

        await expect(page.getByText(/password.*changed|success/i)).toBeVisible({
          timeout: 10000,
        });
      }
    } else {
      test.skip("Password change functionality not available");
    }
  });

  test("should manage email preferences", async ({ page }) => {});

  test("should delete account", async ({ page }) => {});
});
