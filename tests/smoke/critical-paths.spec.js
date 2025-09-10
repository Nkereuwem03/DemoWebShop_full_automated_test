import { test, expect } from "@playwright/test";

test.describe("Smoke Tests - Critical Path", () => {
  const timestamp = Date.now();
  const testEmail = `test${timestamp}@test.com`;

  test.beforeEach(async ({ page }) => {
    await page.goto("https://demowebshop.tricentis.com/");
  });

  test("should complete user checkout flow", async ({ page }) => {
    await expect(page).toHaveTitle("Demo Web Shop");

    // User Registration
    await page.click("a[href='/register']");
    await page.locator("input#gender-male").check();
    await page.fill("input#FirstName", "Test");
    await page.fill("input#LastName", "User");
    await page.fill("input#Email", testEmail);
    await page.fill("input#Password", "Test@1234");
    await page.fill("input#ConfirmPassword", "Test@1234");
    await page.click("input#register-button");
    await expect(page.locator(".result")).toHaveText(
      "Your registration completed"
    );

    // Verify Login
    await expect(
      page.locator("div[class='header-links'] a[class='account']")
    ).toHaveText(testEmail);

    // Product Search
    await page.fill("input#small-searchterms", "Laptop");
    await page.click("input[value='Search']");
    await expect(page).toHaveTitle("Demo Web Shop. Search");
    await expect(page.locator(".item-box .product-item")).toBeVisible();

    // Wait for products to appear and assert at least one is present
    await page.waitForSelector(".item-box .product-item", { timeout: 5000 });
    const productCount = await page.locator(".item-box .product-item").count();
    expect(
      productCount,
      "No products found on the page after login."
    ).toBeGreaterThan(0);

    // Add to Cart
    await page.click("a[href='/141-inch-laptop']");
    await page.click("input#add-to-cart-button-31");
    await expect(page.locator(".bar-notification")).toHaveText(
      "The product has been added to your shopping cart"
    );

    // Proceed to Checkout
    await page.click("a[href='/cart']");
    await page.click("input#termsofservice");
    await page.click("button#checkout");
    await expect(page).toHaveTitle("Demo Web Shop. Checkout");

    // Fill Billing Address
    await page.fill("input#BillingNewAddress_FirstName", "Test");
    await page.fill("input#BillingNewAddress_LastName", "User");
    await page.fill("input#BillingNewAddress_Email", testEmail);
    await page.selectOption("select#BillingNewAddress_CountryId", "Nigeria");
    await page.fill("input#BillingNewAddress_City", "Lagos");
    await page.fill("input#BillingNewAddress_Address1", "123 Test St");
    await page.fill("input#BillingNewAddress_ZipPostalCode", "100001");
    await page.fill("input#BillingNewAddress_PhoneNumber", "1234567890");
    await page.click("input[onclick='Billing.save()']");

    // Fill Shipping Address
    const firstOptionText = await page
      .locator("select#shipping-address-select option")
      .first()
      .textContent();
    await expect(firstOptionText).toContain("Test User, 123 Test St, Lagos");
    await page.click("input[onclick='Shipping.save()']");

    // Select Shipping Method
    await page.check("input#shippingoption_1");
    await page.click("input[onclick='ShippingMethod.save()']");

    // Select Payment Method
    await page.check("input#paymentmethod_1");
    await page.click("input[onclick='PaymentMethod.save()']");

    // Fill Payment Information
    await page.click("input[onclick='PaymentInfo.save()']");

    // Confirm Order
    await page.click("input[onclick='ConfirmOrder.save()']");
    await expect(page.locator("div[class='title'] strong")).toHaveText(
      "Your order has been successfully processed!"
    );
    await page.click("input[value='Continue']");
    await expect(page).toHaveTitle("Demo Web Shop");

    // Logout
    await page.click("a[href='/logout']");
    await expect(page.locator("a[href='/login']")).toBeVisible();
  });

  test("should complete guest checkout flow", async ({ page }) => {
    await expect(page).toHaveTitle("Demo Web Shop");

    const timestamp = Date.now();
    const testEmail = `test${timestamp}@test.com`;

    // Product Search
    await page.fill("input#small-searchterms", "Laptop");
    await page.click("input[value='Search']");
    await expect(page).toHaveTitle("Demo Web Shop. Search");
    await expect(page.locator(".item-box .product-item")).toBeVisible();

    // Wait for products to appear and assert at least one is present
    await page.waitForSelector(".item-box .product-item", {
      timeout: 5000,
    });
    const productCount = await page.locator(".item-box .product-item").count();
    expect(
      productCount,
      "No products found on the page after login."
    ).toBeGreaterThan(0);

    // Add to Cart
    await page.click("a[href='/141-inch-laptop']");
    await page.click("input#add-to-cart-button-31");
    await expect(page.locator(".bar-notification")).toHaveText(
      "The product has been added to your shopping cart"
    );

    // Proceed to Checkout
    await page.click("a[href='/cart']");
    await page.click("input#termsofservice");
    await page.click("button#checkout");
    await expect(page).toHaveTitle("Demo Web Shop. Login");
    await page.click("input[value='Checkout as Guest']");

    // Fill Billing Address
    await page.fill("input#BillingNewAddress_FirstName", "Test");
    await page.fill("input#BillingNewAddress_LastName", "User");
    await page.fill("input#BillingNewAddress_Email", testEmail);
    await page.selectOption("select#BillingNewAddress_CountryId", "Nigeria");
    await page.fill("input#BillingNewAddress_City", "Lagos");
    await page.fill("input#BillingNewAddress_Address1", "123 Test St");
    await page.fill("input#BillingNewAddress_ZipPostalCode", "100001");
    await page.fill("input#BillingNewAddress_PhoneNumber", "1234567890");
    await page.click("input[onclick='Billing.save()']");

    // Fill Shipping Address
    const firstOptionText = await page
      .locator("select#shipping-address-select option")
      .first()
      .textContent();
    await expect(firstOptionText).toContain("Test User, 123 Test St, Lagos");
    await page.click("input[onclick='Shipping.save()']");

    // Select Shipping Method
    await page.check("input#shippingoption_1");
    await page.click("input[onclick='ShippingMethod.save()']");

    // Select Payment Method
    await page.check("input#paymentmethod_1");
    await page.click("input[onclick='PaymentMethod.save()']");

    // Fill Payment Information
    await page.click("input[onclick='PaymentInfo.save()']");

    // Confirm Order
    await page.click("input[onclick='ConfirmOrder.save()']");
    await expect(page.locator("div[class='title'] strong")).toHaveText(
      "Your order has been successfully processed!"
    );
    await page.click("input[value='Continue']");
    await expect(page).toHaveTitle("Demo Web Shop");

    await expect(page.locator("a[href='/login']")).toBeVisible();
  });

  test("should allow users login and logout successfully", async ({
    page,
  }) => {
    await page.click("a[href='/login']");
    await page.fill("input#Email", "user.test123@test.com");
    await page.fill("input#Password", "testuser");
    await page.click("input[value='Log in']");
    await expect(page.locator("a[href='/logout']")).toBeVisible();
    await page.click("a[href='/logout']");
    await expect(page.locator("a[href='/login']")).toBeVisible();
  });

  test("should add item to cart", async ({ page }) => {
    await page.click("a[href='/141-inch-laptop']");
    await page.click("input#add-to-cart-button-31");
    await expect(page.locator(".bar-notification")).toHaveText(
      "The product has been added to your shopping cart"
    );
    await page.click("a[href='/cart']");
    await expect(page.locator(".cart")).toBeVisible();
    const cartItemCount = await page.locator(".cart-item-row").count();
    expect(cartItemCount, "No items found in the cart.").toBeGreaterThan(0);
  });

  test("should perform basic search", async ({ page }) => {
    await page.fill(
      "input#small-searchterms",
      "laptop"
    );
    await page.click("input[class='button-1 search-box-button']");
    await expect(page).toHaveURL(
      "https://demowebshop.tricentis.com/search?q=laptop"
    );
    await expect(page.locator(".product-item")).toHaveCount(1);
    await expect(
      page.locator(".product-item h2")
    ).toHaveText("14.1-inch Laptop");
  });
});
