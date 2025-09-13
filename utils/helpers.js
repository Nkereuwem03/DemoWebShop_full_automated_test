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
