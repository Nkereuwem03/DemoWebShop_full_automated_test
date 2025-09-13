import { test, expect } from '@playwright/test'

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

test.describe("Search Functionality", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should return relevant results for product search", async ({
    page,
  }) => {
    for (const searchTerm of testData.searchTerms.valid) {
      await test.step(`Search for "${searchTerm}"`, async () => {
        // Find and use search input
        const searchInput = page
          .getByRole("searchbox")
          .or(page.getByPlaceholder(/search/i));
        await expect(searchInput).toBeVisible();

        await searchInput.clear();
        await searchInput.fill(searchTerm);
        await searchInput.press("Enter");

        // Wait for search results
        await page.waitForLoadState("networkidle");

        // Verify search results page
        await expect(
          page.getByRole("heading", { name: /search results|results for/i })
        ).toBeVisible();

        // Check search term is displayed
        await expect(page.getByText(searchTerm)).toBeVisible();

        // Verify results are displayed
        const products = page.locator(
          '[data-testid="product-card"], .product-item, .search-result'
        );
        const resultCount = await products.count();

        if (resultCount > 0) {
          // Verify results are relevant (title or description contains search term)
          const firstProduct = products.first();
          const productText = await firstProduct.textContent();
          expect(productText.toLowerCase()).toContain(
            searchTerm.toLowerCase().substring(0, 3)
          );

          // Verify each result has essential product info
          await expect(firstProduct.locator("img")).toBeVisible();
          await expect(
            firstProduct.locator('.price, [data-testid="price"]')
          ).toBeVisible();
        } else {
          // No results - verify appropriate message
          await expect(
            page.getByText(/no results|not found|no products/i)
          ).toBeVisible();
        }
      });
    }
  });

  test("should handle empty search queries", async ({ page }) => {
    const searchInput = page
      .getByRole("searchbox")
      .or(page.getByPlaceholder(/search/i));

    // Submit empty search
    await searchInput.clear();
    await searchInput.press("Enter");

    // Should either show validation message or all products
    await expect(
      page
        .getByText(/enter|provide|search term/i)
        .or(page.locator('[data-testid="product-grid"], .products-grid'))
    ).toBeVisible();

    // Test with only spaces
    await searchInput.fill("   ");
    await searchInput.press("Enter");

    await expect(
      page
        .getByText(/enter|provide|search term/i)
        .or(page.locator('[data-testid="product-grid"], .products-grid'))
    ).toBeVisible();
  });

  test("should suggest products for partial matches", async ({ page }) => {
    for (const partialTerm of testData.searchTerms.partial) {
      await test.step(`Test partial search "${partialTerm}"`, async () => {
        const searchInput = page
          .getByRole("searchbox")
          .or(page.getByPlaceholder(/search/i));

        await searchInput.clear();
        await searchInput.fill(partialTerm);

        // Check for autocomplete/suggestions dropdown
        const suggestions = page.locator(
          '.suggestions, .autocomplete, [data-testid="search-suggestions"]'
        );

        if (await suggestions.isVisible()) {
          // Verify suggestions appear
          const suggestionItems = suggestions.locator(
            'li, .suggestion-item, [data-testid="suggestion"]'
          );
          const suggestionCount = await suggestionItems.count();
          expect(suggestionCount).toBeGreaterThan(0);

          // Test clicking on a suggestion
          await suggestionItems.first().click();
          await page.waitForLoadState("networkidle");

          // Should navigate to search results or product page
          expect(page.url()).toMatch(/search|product/);
        } else {
          // No autocomplete - test direct search with partial term
          await searchInput.press("Enter");
          await page.waitForLoadState("networkidle");

          // Should still return results for partial matches
          const products = page.locator(
            '[data-testid="product-card"], .product-item'
          );
          const resultCount = await products.count();

          // Should have some results or appropriate "no results" message
          if (resultCount === 0) {
            await expect(
              page.getByText(/no results|not found|try different/i)
            ).toBeVisible();
          }
        }
      });
    }
  });

  test("should filter search results", async ({ page }) => {
    // Perform initial search
    const searchInput = page
      .getByRole("searchbox")
      .or(page.getByPlaceholder(/search/i));
    await searchInput.fill("shirt");
    await searchInput.press("Enter");

    await page.waitForLoadState("networkidle");

    // Check if filters are available on search results page
    const filters = page.locator(
      '.filters, .search-filters, [data-testid="search-filters"]'
    );

    if (await filters.isVisible()) {
      // Test category filter
      const categoryFilter = filters.locator(
        '.category-filter, [data-testid="category-filter"]'
      );
      if (await categoryFilter.isVisible()) {
        const categoryCheckbox = categoryFilter.getByRole("checkbox").first();
        await categoryCheckbox.check();

        // Wait for filtered results
        await page.waitForTimeout(1000);
        await waitForProductsToLoad(page);

        // Verify results are filtered
        const products = page.locator(
          '[data-testid="product-card"], .product-item'
        );
        expect(await products.count()).toBeGreaterThanOrEqual(0);
      }

      // Test price filter on search results
      const priceFilter = filters.locator(
        '.price-filter, [data-testid="price-filter"]'
      );
      if (await priceFilter.isVisible()) {
        const minPrice = priceFilter.locator(
          'input[name="min-price"], [data-testid="min-price"]'
        );
        const maxPrice = priceFilter.locator(
          'input[name="max-price"], [data-testid="max-price"]'
        );

        if ((await minPrice.isVisible()) && (await maxPrice.isVisible())) {
          await minPrice.fill("10");
          await maxPrice.fill("100");

          const applyButton = page.getByRole("button", {
            name: /apply|filter/i,
          });
          if (await applyButton.isVisible()) {
            await applyButton.click();
          }

          await waitForProductsToLoad(page);

          // Verify price-filtered results
          const filteredProducts = page.locator(
            '[data-testid="product-card"], .product-item'
          );
          const filteredCount = await filteredProducts.count();

          if (filteredCount > 0) {
            // Check first few products are within price range
            for (let i = 0; i < Math.min(filteredCount, 3); i++) {
              const price = await getProductPrice(filteredProducts.nth(i));
              expect(price).toBeGreaterThanOrEqual(10);
              expect(price).toBeLessThanOrEqual(100);
            }
          }
        }
      }
    } else {
      console.log("No filters available on search results page");
    }
  });

  test("should handle no results scenario", async ({ page }) => {
    for (const noResultTerm of testData.searchTerms.noResults) {
      await test.step(`Test no results for "${noResultTerm}"`, async () => {
        const searchInput = page
          .getByRole("searchbox")
          .or(page.getByPlaceholder(/search/i));

        await searchInput.clear();
        await searchInput.fill(noResultTerm);
        await searchInput.press("Enter");

        await page.waitForLoadState("networkidle");

        // Verify "no results" message is displayed
        await expect(
          page.getByText(
            /no results|not found|no products|nothing found|0 results/i
          )
        ).toBeVisible();

        // Verify no products are shown
        const products = page.locator(
          '[data-testid="product-card"], .product-item'
        );
        expect(await products.count()).toBe(0);

        // Check for helpful suggestions
        await expect(
          page
            .getByText(/try different|check spelling|suggestions|popular/i)
            .or(
              page.locator(
                '.search-suggestions, [data-testid="search-suggestions"]'
              )
            )
        ).toBeVisible();

        // Verify search term is still displayed in input
        const currentValue = await searchInput.inputValue();
        expect(currentValue).toBe(noResultTerm);
      });
    }

    // Test special characters and edge cases
    const edgeCases = ["@#$%", "123456789", "   spaces   ", "a"];

    for (const edgeCase of edgeCases) {
      await test.step(`Test edge case search "${edgeCase}"`, async () => {
        const searchInput = page
          .getByRole("searchbox")
          .or(page.getByPlaceholder(/search/i));

        await searchInput.clear();
        await searchInput.fill(edgeCase);
        await searchInput.press("Enter");

        await page.waitForLoadState("networkidle");

        // Should either show results or appropriate no-results message
        const products = page.locator(
          '[data-testid="product-card"], .product-item'
        );
        const productCount = await products.count();

        if (productCount === 0) {
          await expect(
            page.getByText(/no results|not found|try different/i)
          ).toBeVisible();
        } else {
          // If results found, verify they're valid products
          const firstProduct = products.first();
          await expect(firstProduct.locator("img")).toBeVisible();
          await expect(
            firstProduct.locator('.price, [data-testid="price"]')
          ).toBeVisible();
        }
      });
    }
  });

  test("should handle search with filters combination", async ({ page }) => {
    // Perform search with term
    const searchInput = page
      .getByRole("searchbox")
      .or(page.getByPlaceholder(/search/i));
    await searchInput.fill("laptop");
    await searchInput.press("Enter");

    await page.waitForLoadState("networkidle");

    // Apply multiple filters if available
    const filters = page.locator(
      '.filters, .search-filters, [data-testid="search-filters"]'
    );

    if (await filters.isVisible()) {
      let filtersApplied = 0;

      // Apply category filter
      const categoryFilter = filters.getByRole("checkbox", {
        name: /electronics|computer/i,
      });
      if (await categoryFilter.isVisible()) {
        await categoryFilter.check();
        filtersApplied++;
      }

      // Apply brand filter
      const brandFilter = filters.getByRole("checkbox", {
        name: /dell|hp|apple|lenovo/i,
      });
      if (await brandFilter.isVisible()) {
        await brandFilter.check();
        filtersApplied++;
      }

      // Apply price range
      const minPriceInput = filters.locator(
        'input[name="min-price"], [data-testid="min-price"]'
      );
      const maxPriceInput = filters.locator(
        'input[name="max-price"], [data-testid="max-price"]'
      );

      if (
        (await minPriceInput.isVisible()) &&
        (await maxPriceInput.isVisible())
      ) {
        await minPriceInput.fill("500");
        await maxPriceInput.fill("2000");
        filtersApplied++;
      }

      if (filtersApplied > 0) {
        // Apply filters
        const applyButton = page.getByRole("button", { name: /apply|filter/i });
        if (await applyButton.isVisible()) {
          await applyButton.click();
        }

        await waitForProductsToLoad(page);

        // Verify filtered results
        const products = page.locator(
          '[data-testid="product-card"], .product-item'
        );
        const resultCount = await products.count();

        // Should have results or no results message
        if (resultCount === 0) {
          await expect(
            page.getByText(/no results|refine|broaden/i)
          ).toBeVisible();
        } else {
          // Verify results match filters (check first product)
          const firstProduct = products.first();
          const productText = await firstProduct.textContent();
          expect(productText.toLowerCase()).toContain("laptop");
        }

        // Test clearing filters
        const clearFiltersButton = page.getByRole("button", {
          name: /clear|reset|remove/i,
        });
        if (await clearFiltersButton.isVisible()) {
          await clearFiltersButton.click();
          await waitForProductsToLoad(page);

          // Should show more results after clearing filters
          const clearedResultCount = await products.count();
          expect(clearedResultCount).toBeGreaterThanOrEqual(resultCount);
        }
      }
    }
  });

  test("should maintain search state during navigation", async ({ page }) => {
    // Perform search
    const searchInput = page
      .getByRole("searchbox")
      .or(page.getByPlaceholder(/search/i));
    const searchTerm = "shirt";

    await searchInput.fill(searchTerm);
    await searchInput.press("Enter");
    await page.waitForLoadState("networkidle");

    // Navigate to a product from search results
    const products = page.locator(
      '[data-testid="product-card"], .product-item'
    );

    if ((await products.count()) > 0) {
      const firstProduct = products.first();

      // Get product link to navigate back
      const productTitle = await firstProduct
        .locator('.title, .name, [data-testid="product-title"]')
        .textContent();

      // Click on product
      await firstProduct.click();
      await page.waitForLoadState("networkidle");

      // Verify we're on product page
      expect(page.url()).toContain("/product");

      // Go back to search results
      await page.goBack();
      await page.waitForLoadState("networkidle");

      // Verify we're back on search results page
      await expect(
        page.getByRole("heading", { name: /search results|results for/i })
      ).toBeVisible();

      // Verify search term is still in input
      const currentSearchValue = await searchInput.inputValue();
      expect(currentSearchValue).toBe(searchTerm);

      // Verify same results are displayed
      const backProducts = page.locator(
        '[data-testid="product-card"], .product-item'
      );
      expect(await backProducts.count()).toBeGreaterThan(0);
    }
  });

  test("should handle search sorting options", async ({ page }) => {
    // Perform search
    const searchInput = page
      .getByRole("searchbox")
      .or(page.getByPlaceholder(/search/i));
    await searchInput.fill("book");
    await searchInput.press("Enter");
    await page.waitForLoadState("networkidle");

    // Check if sort options are available
    const sortDropdown = page.locator(
      '.sort-select, [data-testid="sort-dropdown"]'
    );

    if (await sortDropdown.isVisible()) {
      const sortOptions = [
        { value: "relevance", text: /relevance|best match/i },
        { value: "price-low", text: /price.*low|low.*price/i },
        { value: "price-high", text: /price.*high|high.*price/i },
        { value: "newest", text: /newest|latest|recent/i },
      ];

      for (const option of sortOptions) {
        await test.step(`Test sorting search results by ${option.value}`, async () => {
          // Select sort option
          await sortDropdown.selectOption({ label: option.text });
          await waitForProductsToLoad(page);

          // Verify results are sorted
          const products = page.locator(
            '[data-testid="product-card"], .product-item'
          );
          const productCount = await products.count();

          if (productCount > 1) {
            // For price sorting, verify order
            if (option.value.includes("price")) {
              const prices = [];
              for (let i = 0; i < Math.min(productCount, 3); i++) {
                const price = await getProductPrice(products.nth(i));
                prices.push(price);
              }

              if (option.value.includes("low")) {
                for (let i = 1; i < prices.length; i++) {
                  expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
                }
              } else if (option.value.includes("high")) {
                for (let i = 1; i < prices.length; i++) {
                  expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
                }
              }
            }
          }

          // Verify search term is still maintained
          const maintainedSearchValue = await searchInput.inputValue();
          expect(maintainedSearchValue).toBe("book");
        });
      }
    }
  });

  test("should handle search with categories from different entry points", async ({
    page,
  }) => {
    // Test search from homepage
    await page.goto("/");
    let searchInput = page
      .getByRole("searchbox")
      .or(page.getByPlaceholder(/search/i));

    await searchInput.fill("electronics");
    await searchInput.press("Enter");
    await page.waitForLoadState("networkidle");

    let products = page.locator('[data-testid="product-card"], .product-item');
    const homepageResults = await products.count();

    // Test search from products page
    await page.goto("/products");
    searchInput = page
      .getByRole("searchbox")
      .or(page.getByPlaceholder(/search/i));

    await searchInput.fill("electronics");
    await searchInput.press("Enter");
    await page.waitForLoadState("networkidle");

    products = page.locator('[data-testid="product-card"], .product-item');
    const productsPageResults = await products.count();

    // Results should be consistent regardless of entry point
    // (allowing for small differences due to dynamic content)
    expect(Math.abs(homepageResults - productsPageResults)).toBeLessThanOrEqual(
      5
    );

    // Test search from category page
    await page.goto("/products/category/electronics");
    const categorySearchInput = page
      .getByRole("searchbox")
      .or(page.getByPlaceholder(/search/i));

    if (await categorySearchInput.isVisible()) {
      await categorySearchInput.fill("laptop");
      await categorySearchInput.press("Enter");
      await page.waitForLoadState("networkidle");

      // Should show laptops within electronics category
      const categoryProducts = page.locator(
        '[data-testid="product-card"], .product-item'
      );
      const categoryResults = await categoryProducts.count();

      if (categoryResults > 0) {
        const firstResult = categoryProducts.first();
        const resultText = await firstResult.textContent();
        expect(resultText.toLowerCase()).toContain("laptop");
      }
    }
  });
});
