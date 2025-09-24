import { expect } from "@playwright/test";

export const waitForProductsToLoad = async (page) => {
  const products = page.locator(".product-grid .item-box .product-item");
  const noProductsMessage = page.getByText(
    "No products were found that matched your criteria."
  );

  // Wait for either the first product OR the 'no products' message to be visible.
  await expect(products.first().or(noProductsMessage)).toBeVisible();
};

export const getProductPrice = async (productLocator) => {
  const priceText = await productLocator
    .locator(" .details .add-info .prices .actual-price")
    .textContent();
  // Use parseFloat for prices that might have decimals, and handle potential null textContent
  return parseFloat((priceText || "0").replace(/[$,]/g, ""));
};

export const isSortedAsc = (arr) => {
  return arr.every((val, i, a) => i === 0 || a[i - 1] <= val);
};

export const isSortedDesc = (arr) => {
  return arr.every((val, i, a) => i === 0 || a[i - 1] >= val);
};

export const testData = {
  testProducts: [
    { name: "book", expectedPrice: 10, category: "books" },
    { name: "laptop", expectedPrice: 1590, category: "computers" },
    { name: "shirt", expectedPrice: 15, category: "apparel-shoes" },
  ],
  discountCodes: {
    valid: ["SAVE10", "WELCOME5", "DISCOUNT20"],
    invalid: ["EXPIRED123", "INVALID456"],
    percentage: { code: "SAVE10", discount: 10 },
    fixed: { code: "SAVE5", discount: 5 },
  },
  quantities: [1, 2, 5, 10],
  locations: {
    domestic: { country: "United States" },
    international: { country: "Nigeria" },
  },
  guestUser: {
    firstName: "Guest",
    lastName: "User",
    email: "guest@user.com",
    country: "Nigeria",
    city: "Lagos",
    address1: "123 Main St",
    zip: "12345",
    phone: "123-456-7890",
  },
  registeredUser: {
    firstName: "Test",
    lastName: "User",
    loginEmail: "e.e@e.com",
    // loginEmail: "bc@bc.com",
    password: "eeeeee",
    // password: "aaaaaa",
    country: "Nicaragua",
    city: "Lagos",
    address1: "114 Aba Road",
    zip: "12345",
    phone: "123-456-7890",
  },
  updatedProfile: {
    firstName: "Jane",
    lastName: "Smith",
    email: `test${Date.now()}@test.com`,
    gender: "Female",
  },
  paymentMethods: [
    "Payments.CashOnDelivery",
    "Payments.CheckMoneyOrder",
    "Payments.Manual",
    "Payments.PurchaseOrder",
  ],
  paymentData: {
    creditCard: "Visa",
    cardHolder: "John Doe",
    cardNumber: "4242424242424242",
    expiryMonth: "12",
    expiryYear: "2026",
    cardCode: "123",
    purchaseOrderNumber: "PO12345",
  },
  shippingMethods: [
    "Ground___Shipping.FixedRate",
    "Next Day Air___Shipping.FixedRate",
    "2nd Day Air___Shipping.FixedRate",
  ],
  newPassword: {
    current: "aaaaaa",
    new: "bbbbbb",
    confirm: "bbbbbb",
  },
};

export const getCartItemRows = async (page) => {
  const cart1Items = await page.locator(".cart-item-row");
  return await cart1Items;
};

export const getAllCartItemQty = async (page) => {
  try {
    const text = await page.locator(".cart-qty").innerText();
    const cleaned = text.replace(/[()]/g, "").trim();
    return parseInt(cleaned, 10) || 0;
  } catch {
    return 0;
  }
};

export const getFirstCartItemQty = async (page) => {
  await page.goto("/cart");
  await page.waitForLoadState("networkidle");
  const cartItemRows = await page.locator(".cart-item-row").first();
  const qtyText = await cartItemRows.locator(".qty .qty-input").inputValue();
  const qtyCleaned = qtyText.replace(/[""]/g, "").trim();
  const qty = parseInt(qtyCleaned);
  return qty;
};

export const getCartTotal = async (page) => {
  // const totalElement = page.locator(
  //   "span[class='product-price order-total'] strong"
  // );
  const totalElement = page
    .locator(".cart-total-right .nobr .product-price")
    .last();
  if (await totalElement.isVisible()) {
    const totalText = await totalElement.textContent();
    return parseFloat(totalText.replace(/[$,]/g, ""));
  }
  return 0;
};

export const clearCart = async (page) => {
  await page.goto("/cart");
  await page.waitForLoadState("domcontentloaded");

  // Check if cart is already empty
  const emptyCartMessage = page.getByText(/your shopping cart is empty/i);
  if (await emptyCartMessage.isVisible()) {
    return;
  }

  // Otherwise, clear the cart
  const removeItemCheckboxes = page.locator('input[name="removefromcart"]');
  const removeItemCheckboxesCount = await removeItemCheckboxes.count();

  if (removeItemCheckboxesCount > 0) {
    for (let i = 0; i < removeItemCheckboxesCount; i++) {
      await removeItemCheckboxes.nth(i).check();
    }
  }

  const updateCartButton = page.locator('input[name="updatecart"]');
  if (await updateCartButton.isVisible()) {
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes("/cart") && res.status() === 200
      ),
      updateCartButton.click(),
    ]);
  }

  // Final check
  await expect(emptyCartMessage).toBeVisible();
};

export const waitForCartUpdate = async (page) => {
  await page.waitForTimeout(500);
  await page.waitForLoadState("networkidle");
};

export const addProductToCart = async (page, productQuery) => {
  // Search for the product
  const searchInput = page
    .locator("#small-searchterms")
    .or(page.getByPlaceholder(/search/i));

  if (await searchInput.isVisible()) {
    await searchInput.fill(productQuery);
    await searchInput.press("Enter");
    await page.waitForLoadState("networkidle");
  } else {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  }

  // Locate product titles
  const productCards = page.locator(
    ".product-grid .item-box .product-item .details .product-title a"
  );
  const count = await productCards.count();

  let matchedIndex = -1;

  for (let i = 0; i < count; i++) {
    const text = (await productCards.nth(i).innerText()).trim();

    // 1. Exact match (case-insensitive)
    if (text.toLowerCase() === productQuery.toLowerCase()) {
      matchedIndex = i;
      break;
    }

    // 2. Partial match (case-insensitive)
    if (text.toLowerCase().includes(productQuery.toLowerCase())) {
      matchedIndex = i;
      break;
    }
  }

  if (matchedIndex === -1) {
    throw new Error(`No product matched query: "${productQuery}"`);
  }

  // Click on matched product
  const productCard = productCards.nth(matchedIndex);
  await productCard.click();
  await page.waitForLoadState("networkidle");

  // Fill gift card fields if present
  if (await page.locator("#giftcard_2_RecipientName").isVisible()) {
    await page.fill("#giftcard_2_RecipientName", "Test Recipient");
  }
  if (await page.locator("#giftcard_2_RecipientEmail").isVisible()) {
    await page.fill("#giftcard_2_RecipientEmail", "test@example.com");
  }
  if (await page.locator("#giftcard_2_SenderName").isVisible()) {
    await page.fill("#giftcard_2_SenderName", "Test Sender");
  }
  if (await page.locator("#giftcard_2_SenderEmail").isVisible()) {
    await page.fill("#giftcard_2_SenderEmail", "test@example.com");
  }

  // Add to cart
  const addToCartButton = page.locator("input.button-1.add-to-cart-button");
  if (await addToCartButton.isVisible()) {
    await expect(addToCartButton).toBeVisible();
    await addToCartButton.click();

    // Wait for cart update
    const successMessage = /The product has been added to your shopping cart/i;
    await expect(page.locator(".bar-notification")).toContainText(
      successMessage
    );
  }
};

export const addProductToWishlist = async (page, productQuery) => {
  // Search for the product
  const searchInput = page
    .locator("#small-searchterms")
    .or(page.getByPlaceholder(/search/i));

  if (await searchInput.isVisible()) {
    await searchInput.fill(productQuery);
    await searchInput.press("Enter");
    await page.waitForLoadState("networkidle");
  } else {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  }

  // Locate product titles
  const productCards = page.locator(
    ".product-grid .item-box .product-item .details .product-title a"
  );
  const count = await productCards.count();

  let matchedIndex = -1;

  for (let i = 0; i < count; i++) {
    const text = (await productCards.nth(i).innerText()).trim();

    // 1. Exact match (case-insensitive)
    if (text.toLowerCase() === productQuery.toLowerCase()) {
      matchedIndex = i;
      break;
    }

    // 2. Partial match (case-insensitive)
    if (text.toLowerCase().includes(productQuery.toLowerCase())) {
      matchedIndex = i;
      break;
    }
  }

  if (matchedIndex === -1) {
    throw new Error(`No product matched query: "${productQuery}"`);
  }

  // Click on matched product
  const productCard = productCards.nth(matchedIndex);
  await productCard.click();
  await page.waitForLoadState("networkidle");

  // Fill gift card fields if present
  if (await page.locator("#giftcard_2_RecipientName").isVisible()) {
    await page.fill("#giftcard_2_RecipientName", "Test Recipient");
  }
  if (await page.locator("#giftcard_2_RecipientEmail").isVisible()) {
    await page.fill("#giftcard_2_RecipientEmail", "test@example.com");
  }
  if (await page.locator("#giftcard_2_SenderName").isVisible()) {
    await page.fill("#giftcard_2_SenderName", "Test Sender");
  }
  if (await page.locator("#giftcard_2_SenderEmail").isVisible()) {
    await page.fill("#giftcard_2_SenderEmail", "test@example.com");
  }

  // Add to cart
  const addToWishlistButton = page.locator("input.add-to-wishlist-button");
  if (await addToWishlistButton.isVisible()) {
    await expect(addToWishlistButton).toBeVisible();
    await addToWishlistButton.click();

    // Wait for cart update
    const successMessage = /The product has been added to your wishlist/i;
    await expect(page.locator(".bar-notification")).toContainText(
      successMessage
    );
  }
};

export const estimatedShipping = async (page, country) => {
  const shippingSection = page.locator(".estimate-shipping");

  if (await shippingSection.isVisible()) {
    // Enter shipping address
    const selectCountry = page.locator("#CountryId");
    await selectCountry.click();
    await selectCountry.waitFor({ state: "visible" });
    if (await selectCountry.isVisible()) {
      await selectCountry.selectOption(country);
    }
  }
};

export const proceedToCheckout = async (page) => {
  await page.goto("/cart");
  await page.waitForLoadState("networkidle");

  const termsCheckbox = page.locator("#termsofservice");
  await expect(termsCheckbox).toBeVisible();
  await termsCheckbox.check();

  const checkoutButton = page.getByRole("button", {
    name: /checkout|proceed/i,
  });
  await expect(checkoutButton).toBeVisible();
  await checkoutButton.click();
};

export const login = async (page, loginDetails) => {
  await page.goto("/login");
  await page.getByLabel(/email|username/i).fill(loginDetails.loginEmail);
  await page.getByLabel(/password/i).fill(loginDetails.password);
  await page.getByRole("button", { name: /login|log in|sign in/i }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".header-links li .account")).toHaveText(
    loginDetails.loginEmail
  );
};

export const checkoutAsGuest = async (page) => {
  const checkoutAsGuest = page.locator("input[value='Checkout as Guest']");
  if (await checkoutAsGuest.isVisible()) {
    await checkoutAsGuest.click();
    await page.waitForLoadState("networkidle");
  }
};

export const fillBillingAddress = async (page, user) => {
  if (!user) {
    throw new Error("User data is required for billing address");
  }

  const fields = [
    {
      locator: "#BillingNewAddress_FirstName",
      value: user.firstName,
      name: "First Name",
    },
    {
      locator: "#BillingNewAddress_LastName",
      value: user.lastName,
      name: "Last Name",
    },
    { locator: "#BillingNewAddress_Email", value: user.email, name: "Email" },
    { locator: "#BillingNewAddress_City", value: user.city, name: "City" },
    {
      locator: "#BillingNewAddress_Address1",
      value: user.address1,
      name: "Address",
    },
    {
      locator: "#BillingNewAddress_ZipPostalCode",
      value: user.zip,
      name: "ZIP",
    },
    {
      locator: "#BillingNewAddress_PhoneNumber",
      value: user.phone,
      name: "Phone",
    },
  ];

  // Fill text fields
  for (const field of fields) {
    const element = page.locator(field.locator);
    if ((await element.isVisible()) && field.value) {
      await element.fill(field.value);
    }
  }

  // Handle country dropdown
  const country = page.locator("#BillingNewAddress_CountryId");
  if ((await country.isVisible()) && user.country) {
    await country.selectOption(user.country);
    await page.waitForTimeout(1000); // Wait for state/province to load
  }

  // Handle state/province if available
  const state = page.locator("#BillingNewAddress_StateProvinceId");
  if ((await state.isVisible()) && user.state) {
    await state.selectOption(user.state);
  }

  const continueButton = page.locator("input[onclick='Billing.save()']");
  await expect(continueButton).toBeVisible();
  await continueButton.click();
  await page.waitForLoadState("networkidle");

  return user;
};

export const validateShippingAddress = async (
  page,
  user,
  inStorePickup = false
) => {
  const inStorePickupLocator = page.locator("#PickUpInStore");

  if (inStorePickup && (await inStorePickupLocator.isVisible())) {
    await inStorePickupLocator.check();
    await expect(inStorePickupLocator).toBeChecked();
  } else {
    // Verify shipping address is populated
    const addressSelect = page.locator("#shipping-address-select");
    if (await addressSelect.isVisible()) {
      const firstOption = addressSelect.locator("option").first();
      if (await firstOption.isVisible()) {
        const optionText = (await firstOption.textContent()).trim();

        // Verify address components
        expect(optionText).toContain(user.firstName);
        expect(optionText).toContain(user.lastName);
        expect(optionText).toContain(user.address1);
        expect(optionText).toContain(user.city);
      }
    }
  }

  const continueButton = page.locator("#shipping-buttons-container input");
  await expect(continueButton).toBeVisible();
  if (await continueButton.isVisible()) {
    await continueButton.click();
    await page.waitForLoadState("networkidle");
  }
};

export const selectShippingMethod = async (page, method) => {
  await page.waitForSelector(".method-name label", {
    timeout: 10000,
  });

  const shippingOptions = page.locator("input[name='shippingoption']");
  const count = await shippingOptions.count();
  expect(count).toBeGreaterThan(0);

  let methodSelected = false;

  for (let i = 0; i < count; i++) {
    const value = (
      await shippingOptions.nth(i).getAttribute("value")
    )?.toLowerCase();
    if (value?.includes(method.toLowerCase())) {
      await shippingOptions.nth(i).check({ force: true });
      await expect(shippingOptions.nth(i)).toBeChecked();
      methodSelected = true;
      break;
    }
  }

  if (!methodSelected) {
    // Fallback to first available option
    await shippingOptions.first().check({ force: true });
  }

  await page.waitForLoadState("networkidle");

  const continueButton = page.getByRole("button", { name: /continue|next/i });
  if (await continueButton.isVisible()) {
    await continueButton.click();
    await page.waitForLoadState("networkidle");
  }
};

export const fillPaymentMethod = async (page, paymentmethod) => {
  // Wait until payment options appear
  await page.waitForSelector("input[name='paymentmethod']");

  const methods = page.locator("input[name='paymentmethod']");
  const count = await methods.count();

  for (let i = 0; i < count; i++) {
    const value = (await methods.nth(i).getAttribute("value"))?.toLowerCase();
    if (value === paymentmethod.toLowerCase()) {
      // Some payment radios are hidden, so use force if needed
      await methods.nth(i).check({ force: true });

      // Wait for any page updates caused by selection
      await page.waitForLoadState("networkidle");

      break;
    }
  }

  // Continue button (adjust regex if your site uses a more specific label)
  const continueBtn = page.getByRole("button", { name: /continue|next/i });

  if (await continueBtn.isVisible()) {
    await continueBtn.click();
    await page.waitForLoadState("networkidle");
  }

  return true; // payment method successfully selected
};

export const safeIsVisible = async (locator, timeout = 3000) => {
  try {
    await locator.waitFor({ state: "attached", timeout });
    return await locator.isVisible();
  } catch {
    return false;
  }
};

export const fillPaymentInfo = async (page, paymentData) => {
  const selectCard = page.locator(".payment-info .info #CreditCardType");
  const purchaseOrderNumber = page.locator(
    ".payment-info .info #PurchaseOrderNumber"
  );
  const otherInfo = page.locator(".payment-info .info p").first();

  const isCardVisible = await safeIsVisible(selectCard);
  const isPurchaseVisible = await safeIsVisible(purchaseOrderNumber);
  const isOtherInfoVisible = await safeIsVisible(otherInfo);

  if (isCardVisible) {
    console.log("Credit card flow");
    await selectCard.selectOption(paymentData.creditCard);

    const cardholderName = page.locator("#CardholderName");
    if (await safeIsVisible(cardholderName)) {
      await cardholderName.fill(paymentData.cardHolder);
    }

    const cardNumber = page.locator("#CardNumber");
    if (await safeIsVisible(cardNumber)) {
      await cardNumber.fill(paymentData.cardNumber);
    }

    const expirationMonth = page.locator(".payment-info .info #ExpireMonth");
    if (await safeIsVisible(expirationMonth)) {
      await expirationMonth.selectOption(paymentData.expiryMonth);
    }

    const expirationYear = page.locator(".payment-info .info #ExpireYear");
    if (await safeIsVisible(expirationYear)) {
      await expirationYear.selectOption(paymentData.expiryYear);
    }

    const cardCode = page.locator("#CardCode");
    if (await safeIsVisible(cardCode)) {
      await cardCode.fill(paymentData.cardCode);
    }
  } else if (isPurchaseVisible) {
    console.log("Purchase order flow");
    await purchaseOrderNumber.fill(paymentData.purchaseOrderNumber);
  } else if (isOtherInfoVisible) {
    console.log("Other payment info shown:", await otherInfo.textContent());
  } else {
    console.log("No payment method visible");
  }

  // Continue button handling (works in all flows)
  const continueBtn = page.locator("#payment-info-buttons-container input");
  if (await safeIsVisible(continueBtn)) {
    await continueBtn.click();
    await page.waitForLoadState("networkidle");
  }
};

export const confirmOrder = async (page, cartTotalPrice) => {
  // Check payment method
  const paymentMethod = page.locator("li.payment-method");
  await expect(paymentMethod).toBeVisible();
  const paymentMethodText = (await paymentMethod.textContent())?.trim() ?? "";

  // Subtotal check
  const subTotalAtCheckout = page
    .locator(".cart-total tbody tr", {
      hasText: "Sub-Total:",
    })
    .locator(".product-price");

  await expect(subTotalAtCheckout).toBeVisible();
  const subTotalAtCheckoutString =
    (await subTotalAtCheckout.textContent()) ?? "0";
  const subTotal = parseFloat(subTotalAtCheckoutString.replace(/[$,]/g, ""));

  // Total check
  const totalAtCheckout = page
    .locator(".cart-total-right .nobr .product-price")
    .last();

  await expect(totalAtCheckout).toBeVisible();
  const totalAtCheckoutString = (await totalAtCheckout.textContent()) ?? "0";
  const total = parseFloat(totalAtCheckoutString.replace(/[$,]/g, ""));

  const feeValue = page
    .locator(".cart-total tbody tr", {
      hasText: "Payment method additional fee:",
    })
    .locator(".product-price");

  let fee = 0;

  // Check if the element exists at all
  if ((await feeValue.count()) > 0) {
    // Now safe to wait for it
    await feeValue.waitFor({ state: "visible" });

    const feeString = (await feeValue.textContent()) ?? "0";
    fee = parseFloat(feeString.replace(/[$,]/g, ""));

    if (paymentMethodText === "Cash On Delivery (COD)") {
      expect(fee).toBe(7);
      // expect(cartTotalPrice).toBe(subTotal);
      // expect(total).toBe(cartTotalPrice + 7);
      // expect(total).toBe(subTotal + 7);
    } else if (paymentMethodText === "Check / Money Order") {
      expect(fee).toBe(5);
      // expect(cartTotalPrice).toBe(subTotal);
      // expect(total).toBe(cartTotalPrice + 5);
      // expect(total).toBe(subTotal + 5);
    } else if (paymentMethodText === "Credit Card") {
      expect(fee).toBe(0);
      // expect(cartTotalPrice).toBe(subTotal);
      // expect(total).toBe(cartTotalPrice);
      // expect(total).toBe(subTotal);
    } else if (paymentMethodText === "Purchase Order") {
      expect(fee).toBe(0);
      // expect(cartTotalPrice).toBe(subTotal);
      // expect(total).toBe(cartTotalPrice);
      // expect(total).toBe(subTotal);
    } else {
      throw new Error(`Unexpected payment method: ${paymentMethodText}`);
    }
  }

  const confirmBtn = page.getByRole("button", { name: /confirm/i });
  await expect(confirmBtn).toBeVisible();
  await confirmBtn.click();

  await page.waitForLoadState("networkidle");
};

export const confirmationMessage = async (page) => {
  const msg = await page.locator("div.title strong").textContent();
  expect(msg).toMatch(/Your order has been successfully processed!/i);

  const continueBtn = page.getByRole("button", { name: /continue/i });
  if (await continueBtn.isVisible()) {
    await continueBtn.click();
  }

  await expect(page).toHaveURL(/\/$/);
};

export const getOrderNumber = async (page) => {
  const order = await page.locator("ul[class='details'] li").first();

  await expect(order).toBeVisible();

  const orderText = await order.textContent();

  const orderNumber = orderText?.match(/\d+/)?.[0] ?? null;

  console.log("Order number:", orderNumber);
  return orderNumber;
};
