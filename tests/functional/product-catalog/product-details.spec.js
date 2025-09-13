import { test, expect } from "@playwright/test";
import { waitForProductsToLoad } from "../../../utils/helpers.js";

test.describe("Product Details Functionality", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/desktops");
    await waitForProductsToLoad(page);
    await page.waitForLoadState("networkidle");
  });

  test("should display product information correctly", async ({ page }) => {
    const productsCount = await page
      .locator(".product-grid .item-box .product-item")
      .count();

    for (let i = 0; i < Math.min(productsCount, 3); i++) {
      const product = page
        .locator(".product-grid .item-box .product-item")
        .nth(i);
      await product.locator(".details .product-title a").click();
      await page.waitForLoadState("networkidle");

      // Verify essential product information is displayed
      await expect(
        page
          .getByRole("heading", { level: 1 })
          .or(page.locator("h1[itemprop='name']"))
      ).toBeVisible();

      // Verify price is displayed
      await expect(page.locator("span[itemprop='price']")).toBeVisible();

      // Verify product description
      await expect(
        page.locator("div[class='full-description'] p")
      ).toBeVisible();

      // Verify product image
      await expect(page.locator("img[itemprop='image']")).toBeVisible();

      // Verify add to cart button
      const addToCartButton = page.locator(".button-1 .add-to-cart-button");
      if (await addToCartButton.isVisible()) {
        await expect(addToCartButton).toBeEnabled();
      }
    }
  });

  test("should show main product image", async ({ page }) => {
    const productsCount = await page
      .locator(".product-grid .item-box .product-item")
      .count();

    for (let i = 0; i < Math.min(productsCount, 3); i++) {
      const product = page
        .locator(".product-grid .item-box .product-item")
        .nth(i);
      await product.locator(".details .product-title a").click();
      await page.waitForLoadState("networkidle");

      // Verify product image
      await expect(page.locator("img[itemprop='image']")).toBeVisible();
    }
  });

  /* test.only("should display customer reviews", async ({ page }) => {
    
  }); */

  /* test("should calculate price with options/variants", async ({ page }) => {
    
  }); */

  test("should show related products", async ({ page }) => {
    const productsCount = await page
      .locator(".product-grid .item-box .product-item")
      .count();

    for (let i = 0; i < Math.min(productsCount, 3); i++) {
      const product = page
        .locator(".product-grid .item-box .product-item")
        .nth(i);
      await product.locator(".details .product-title a").click();
      await page.waitForLoadState("networkidle");

      // Look for related products
      const relatedSection = page.locator(
        ".product-collateral .also-purchased-products-grid"
      );

      if (await relatedSection.isVisible()) {
        await expect(relatedSection).toBeVisible();

        // Verify section has heading
        await expect(
          relatedSection.locator(
            ".title strong"
          )
        ).toBeVisible();

        // Verify related products are displayed
        const relatedProducts = relatedSection.locator(
          ".item-box .product-item"
        );
        const relatedCount = await relatedProducts.count();

        if (relatedCount > 0) {

          // Verify each related product has essential info
          const firstRelated = relatedProducts.first();
          await expect(firstRelated.locator(".picture a img")).toBeVisible();
          await expect(
            firstRelated.locator(".details .add-info .prices .price")
          ).toBeVisible();

          // Test clicking on related product
          const productLink = firstRelated.locator(".picture a").first();
          await expect(productLink).toBeVisible();
          /* const href = await productLink.getAttribute("href");
          expect(href).toMatch(/\/product/); */

          // Click and verify navigation
          /* await productLink.click();
          await page.waitForLoadState("networkidle");
          expect(page.url()).toContain("/product"); */
        }
      }
    }
  });
});
