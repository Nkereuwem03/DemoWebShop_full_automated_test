import { test, expect } from "@playwright/test";
import {
  waitForProductsToLoad,
  getProductPrice,
  isSortedAsc,
  isSortedDesc,
} from "../../../utils/helpers.js";

const testData = {
  categories: [
    { name: "books", url: "books" },
    { name: "computers", url: "computers" },
    { name: "electronics", url: "electronics" },
    { name: "apparel & shoes", url: "apparel-shoes" },
    { name: "digital downloads", url: "digital-downloads" },
    { name: "jewelry", url: "jewelry" },
    { name: "gift cards", url: "gift-cards" },
  ],
  priceRanges: {
    low: { min: 0, max: 50 },
    medium: { min: 50, max: 200 },
    high: { min: 200, max: 1000 },
  },
  searchTerms: {
    valid: ["laptop", "shirt", "book", "chair"],
    partial: ["lap", "shi", "boo"],
    noResults: ["xyznoproduct", "impossibleitem"],
  },
};

test.describe("Product Listing Functionality", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display all products on category page", async ({ page }) => {
    for (let i = 0; i < testData.categories.length; i++) {
      const category = testData.categories[i];
      await page.goto(`/${category.url}`);

      // locate subcategories only by title links
      const subCategories = page.locator(".sub-category-item .title a");
      const subCount = await subCategories.count();

      if (subCount > 0) {
        for (let j = 0; j < subCount; j++) {
          const subCategoryLink = subCategories.nth(j);
          const subCategoryName = (await subCategoryLink.innerText()).trim();

          if (!subCategoryName) continue; // skip empty links

          await subCategoryLink.click();

          // collect products
          const products = page.locator(".product-item");
          const productCount = await products.count();

          // assert at least one product or "no products" message
          if (productCount > 0) {
            for (let k = 0; k < Math.min(productCount, 5); k++) {
              const product = products.nth(k);
              await expect(product.locator(".product-title")).toBeVisible();
              await expect(product.locator(".prices")).toBeVisible();
            }
          } else {
            await expect(
              page.getByText(
                "No products were found that matched your criteria."
              )
            ).toBeVisible();
          }

          // go back to top-level category
          await page.goto(`/${category.url}`);
        }
      } else {
        // no subcategories → just check products in category
        const products = page.locator(".product-item");
        const productCount = await products.count();

        if (productCount > 0) {
          for (let k = 0; k < Math.min(productCount, 5); k++) {
            const product = products.nth(k);
            await expect(product.locator(".product-title")).toBeVisible();
            await expect(product.locator(".prices")).toBeVisible();
          }
        } else {
          await expect(
            page.getByText("No products were found that matched your criteria.")
          ).toBeVisible();
        }
      }
    }
  });

  test("should filter products by price range", async ({ page }) => {
    const priceFilters = [
      {
        label: "Under 1000.00",
        check: (price) =>
          expect(price, `Price ${price} should be < 1000`).toBeLessThan(1000),
      },
      {
        label: "1000.00 - 1200.00",
        check: (price) => {
          expect(
            price,
            `Price ${price} should be >= 1000`
          ).toBeGreaterThanOrEqual(1000);
          expect(price, `Price ${price} should be <= 1200`).toBeLessThanOrEqual(
            1200
          );
        },
      },
      {
        label: "Over 1200.00",
        check: (price) =>
          expect(
            price,
            `Price ${price} should be > 1200`
          ).toBeGreaterThanOrEqual(1200),
      },
    ];

    for (const { label, check } of priceFilters) {
      await test.step(`Filter by price: ${label}`, async () => {
        await page.goto("/desktops");
        // Use regex for selector robustness
        await page.locator("a", { hasText: new RegExp(label, "i") }).click();
        await page.waitForLoadState("networkidle");

        const products = page.locator(".product-grid .item-box .product-item");
        const productCount = await products.count();

        if (productCount > 0) {
          for (let i = 0; i < Math.min(productCount, 3); i++) {
            let price;
            try {
              price = await getProductPrice(products.nth(i));
            } catch (e) {
              throw new Error(
                `Failed to get price for product #${i + 1}: ${e}`
              );
            }
            check(price);
          }
        } else {
          await expect(
            page.getByText("No products were found that matched your criteria.")
          ).toBeVisible();
        }
      });
    }
  });

  test("should sort products correctly", async ({ page }) => {
    const sortOptions = [
      { label: "Name: A to Z", type: "name-asc" },
      { label: "Name: Z to A", type: "name-desc" },
      { label: "Price: Low to High", type: "price-asc" },
      { label: "Price: High to Low", type: "price-desc" },
      { label: "Created on", type: "date" },
    ];

    await page.goto("/desktops");
    const sortDropdown = page.locator("#products-orderby");
    await expect(sortDropdown).toBeVisible();

    for (const { label, type } of sortOptions) {
      await test.step(`Sorting by ${label}`, async () => {
        await sortDropdown.selectOption({ label });
        await waitForProductsToLoad(page);

        const products = page.locator(".product-grid .item-box .product-item");
        const count = await products.count();

        // Case 1: No products
        if (count === 0) {
          await expect(
            page.getByText("No products were found that matched your criteria.")
          ).toBeVisible();
          return;
        }

        // Case 2: One product (trivially sorted)
        if (count === 1) {
          console.log(`Only 1 product found, sorting has no visible effect.`);
          return;
        }

        // Case 3: Two or more products
        const sampleCount = Math.min(count, 10); // Use up to 10 products

        if (type.startsWith("name")) {
          const names = [];
          for (let i = 0; i < sampleCount; i++) {
            const text = await products
              .nth(i)
              .locator(".product-title a")
              .textContent();
            names.push((text || "").trim().toLowerCase());
          }

          const first = names[0];
          const last = names[names.length - 1];

          if (type === "name-asc") {
            expect(isSortedAsc(names)).toBeTruthy();
            expect(first <= last).toBeTruthy();
          } else {
            expect(isSortedDesc(names)).toBeTruthy();
            expect(first >= last).toBeTruthy();
          }
        }

        if (type.startsWith("price")) {
          const prices = [];
          for (let i = 0; i < sampleCount; i++) {
            prices.push(await getProductPrice(products.nth(i)));
          }

          const first = prices[0];
          const last = prices[prices.length - 1];

          if (type === "price-asc") {
            expect(isSortedAsc(prices)).toBeTruthy();
            expect(first <= last).toBeTruthy();
          } else {
            expect(isSortedDesc(prices)).toBeTruthy();
            expect(first >= last).toBeTruthy();
          }
        }

        // Created-on sorting can be implemented if product date data is available
      });
    }
  });
});
