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

export function isSortedAsc(arr) {
  return arr.every((val, i, a) => i === 0 || a[i - 1] <= val);
}

export function isSortedDesc(arr) {
  return arr.every((val, i, a) => i === 0 || a[i - 1] >= val);
}

export const testData = {
  testProducts: [
    { name: "laptop", expectedPrice: 1590, category: "computers" },
    { name: "book", expectedPrice: 10, category: "books" },
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
  const termsCheckbox = page.locator("#termsofservice");
  await expect(termsCheckbox).toBeVisible();
  await termsCheckbox.check();

  const checkoutButton = page.getByRole("button", {
    name: /checkout|proceed/i,
  });
  await expect(checkoutButton).toBeVisible();
  await checkoutButton.click();
};
