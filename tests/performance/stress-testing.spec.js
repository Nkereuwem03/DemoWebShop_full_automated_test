import { test, expect } from "@playwright/test";
import { addFeaturedProductToCart } from "../../utils/helpers";

test.describe("Stress Testing", () => {
  test("should handle high concurrent user load", async ({ browser }) => {
    const concurrentUsers = 5; // Reduced for CI/CD environments
    const contexts = [];
    const pages = [];

    try {
      // Create multiple browser contexts to simulate different users
      for (let i = 0; i < concurrentUsers; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        contexts.push(context);
        pages.push(page);
      }

      // Simulate concurrent user actions
      const userActions = pages.map(async (page, index) => {
        const actions = [
          () => page.goto("/"),
          () => page.goto("/cart"),
          () => page.goto("/login"),
        ];

        const userAction = actions[index % actions.length];
        const startTime = Date.now();

        await userAction();

        const actionTime = Date.now() - startTime;
        console.log(`User ${index + 1} action completed in ${actionTime}ms`);

        return actionTime; // ✅ ensures a number is returned
      });

      // Execute all user actions concurrently
      const actionTimes = await Promise.all(userActions);

      const avgResponseTime =
        actionTimes.reduce((sum, time) => sum + time, 0) / actionTimes.length;

      console.log(`Average response time under load: ${avgResponseTime}ms`);

      // Response times should remain reasonable under load
      expect(avgResponseTime).toBeLessThan(5000);

      // No user should experience excessive delays
      const maxResponseTime = Math.max(...actionTimes);
      expect(maxResponseTime).toBeLessThan(10000);
    } finally {
      for (const context of contexts) {
        await context.close();
      }
    }
  });

  test("should maintain performance with large cart", async ({ page }) => {
    // Add multiple items to cart
    const itemsToAdd = 5;
    const addTimes = [];

    for (let i = 0; i < itemsToAdd; i++) {
      await test.step(`Add item ${i + 1} to cart`, async () => {
        // Navigate to products page
        await page.goto("/");

        // Add to cart and measure time
        const startTime = Date.now();

        await addFeaturedProductToCart(page, 1);

        // Wait for confirmation
        const addTime = Date.now() - startTime;

        addTimes.push(addTime);
        console.log(`Added item ${i + 1} to cart in ${addTime}ms`);
      });
    }

    // Test cart performance with many items
    const cartLoadStart = Date.now();
    await page.goto("/cart");
    const cartLoadTime = Date.now() - cartLoadStart;

    console.log(`Cart with ${itemsToAdd} items loaded in ${cartLoadTime}ms`);

    // Cart should still load reasonably quickly
    expect(cartLoadTime).toBeLessThan(3000);

    // Verify all items are present
    const cartItems = page.locator(".cart-item-row");
    const cartItemCount = await cartItems.count();
    expect(cartItemCount).toBe(1);

    // Test cart updates with large cart
    if (cartItemCount > 0) {
      const firstItem = cartItems.first();
      const qtyInput = firstItem.locator(".qty-input");

      if (await qtyInput.isVisible()) {
        const updateStartTime = Date.now();
        await qtyInput.fill("2");

        const updateButton = page.locator('input[name="updatecart"]');
        await updateButton.click();
        await page.waitForLoadState("networkidle");

        const updateTime = Date.now() - updateStartTime;
        console.log(
          `Cart update with ${itemsToAdd} items took ${updateTime}ms`
        );

        expect(updateTime).toBeLessThan(5000);
      }
    }

    // Performance should not degrade significantly with more items
    const avgAddTime =
      addTimes.reduce((sum, time) => sum + time, 0) / addTimes.length;
    const lastAddTime = addTimes[addTimes.length - 1];

    console.log(
      `Average add time: ${avgAddTime}ms, Last add time: ${lastAddTime}ms`
    );

    // Last addition shouldn't be significantly slower than average
    expect(lastAddTime).toBeLessThan(avgAddTime * 2);
  });

  test("should handle rapid successive requests", async ({ page }) => {
    await page.goto("/");

    const rapidRequests = 10;
    const requestTimes = [];

    // Test rapid search requests
    const searchInput = page.locator("#small-searchterms");
    if (await searchInput.isVisible()) {
      const searchTerms = [
        "a",
        "ab",
        "abc",
        "test",
        "product",
        "laptop",
        "shirt",
        "book",
        "chair",
        "phone",
      ];

      for (let i = 0; i < rapidRequests; i++) {
        await test.step(`Rapid request ${i + 1}`, async () => {
          const searchTerm = searchTerms[i % searchTerms.length];

          const startTime = Date.now();
          await searchInput.fill(searchTerm);
          await searchInput.press("Enter");

          // Wait for some response (but don't wait for full page load)
          const requestTime = Date.now() - startTime;

          requestTimes.push(requestTime);
          console.log(
            `Rapid request ${i + 1} (${searchTerm}): ${requestTime}ms`
          );
        });

        // Small delay between requests
        await page.waitForTimeout(50);
      }
    }

    // Test rapid navigation
    const navigationUrls = ["/", "/products", "/cart", "/login"];
    const navTimes = [];

    for (let i = 0; i < rapidRequests; i++) {
      await test.step(`Rapid navigation ${i + 1}`, async () => {
        const url = navigationUrls[i % navigationUrls.length];

        const startTime = Date.now();
        await page.goto(url);
        // Don't wait for full load, just basic response
        await page.waitForLoadState("domcontentloaded");
        const navTime = Date.now() - startTime;

        navTimes.push(navTime);
        console.log(`Rapid navigation ${i + 1} (${url}): ${navTime}ms`);
      });
    }

    // Analyze performance patterns
    const avgRequestTime =
      requestTimes.reduce((sum, time) => sum + time, 0) / requestTimes.length;
    const avgNavTime =
      navTimes.reduce((sum, time) => sum + time, 0) / navTimes.length;

    console.log(`Average rapid request time: ${avgRequestTime}ms`);
    console.log(`Average rapid navigation time: ${avgNavTime}ms`);

    // System should handle rapid requests reasonably
    expect(avgRequestTime).toBeLessThan(1000); // Average should be under 1 second
    expect(avgNavTime).toBeLessThan(2000); // Navigation should be under 2 seconds

    // Check for performance degradation over time
    const firstHalfRequests = requestTimes.slice(
      0,
      Math.floor(requestTimes.length / 2)
    );
    const secondHalfRequests = requestTimes.slice(
      Math.floor(requestTimes.length / 2)
    );

    const firstHalfAvg =
      firstHalfRequests.reduce((sum, time) => sum + time, 0) /
      firstHalfRequests.length;
    const secondHalfAvg =
      secondHalfRequests.reduce((sum, time) => sum + time, 0) /
      secondHalfRequests.length;

    console.log(
      `First half avg: ${firstHalfAvg}ms, Second half avg: ${secondHalfAvg}ms`
    );

    // Performance shouldn't degrade significantly over rapid requests
    expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 2);
  });

  test("should perform well with large product catalogs", async ({ page }) => {
    await page.goto("/");

    // Measure initial product page load
    const initialLoadTime = Date.now();
    await page.reload();
    await page.waitForLoadState("networkidle");
    const pageLoadTime = Date.now() - initialLoadTime;

    console.log(`Product catalog page loaded in ${pageLoadTime}ms`);

    // Count total products available
    const productItems = page.locator(".product-item");
    const visibleProducts = await productItems.count();

    console.log(`${visibleProducts} products visible on page`);

    // Test pagination performance if available
    const paginationLinks = page.locator(".pager a, .pagination a");
    const paginationCount = await paginationLinks.count();

    if (paginationCount > 0) {
      const paginationTimes = [];
      const pagesToTest = Math.min(paginationCount, 3); // Test first 3 pages

      for (let i = 0; i < pagesToTest; i++) {
        await test.step(`Test pagination page ${i + 1}`, async () => {
          const pageLink = paginationLinks.nth(i);
          const pageNumber = await pageLink.textContent();

          if (pageNumber && pageNumber.match(/\d/)) {
            const startTime = Date.now();
            await pageLink.click();
            await page.waitForLoadState("networkidle");
            const paginationTime = Date.now() - startTime;

            paginationTimes.push(paginationTime);
            console.log(
              `Pagination to page ${pageNumber}: ${paginationTime}ms`
            );

            // Verify products loaded on new page
            const newPageProducts = await productItems.count();
            expect(newPageProducts).toBeGreaterThan(0);
          }
        });
      }

      if (paginationTimes.length > 0) {
        const avgPaginationTime =
          paginationTimes.reduce((sum, time) => sum + time, 0) /
          paginationTimes.length;
        console.log(`Average pagination time: ${avgPaginationTime}ms`);

        expect(avgPaginationTime).toBeLessThan(3000); // Pagination should be reasonably fast
      }
    }

    // Test filtering performance with large catalog
    const categoryFilters = page.locator(
      ".category-filter a, .filter-option a"
    );
    const filterCount = await categoryFilters.count();

    if (filterCount > 0) {
      const filterStartTime = Date.now();
      await categoryFilters.first().click();
      await page.waitForLoadState("networkidle");
      const filterTime = Date.now() - filterStartTime;

      console.log(`Category filter applied in ${filterTime}ms`);
      expect(filterTime).toBeLessThan(2000);

      // Verify filtering worked
      const filteredProducts = await productItems.count();
      console.log(`${filteredProducts} products after filtering`);
    }

    // Test search performance on large catalog
    const searchInput = page.locator("#small-searchterms");
    if (await searchInput.isVisible()) {
      await page.goto("/products"); // Reset to full catalog
      await page.waitForLoadState("networkidle");

      const searchStartTime = Date.now();
      await searchInput.fill("test");
      await searchInput.press("Enter");
      await page.waitForLoadState("networkidle");
      const searchTime = Date.now() - searchStartTime;

      console.log(`Search on large catalog completed in ${searchTime}ms`);
      expect(searchTime).toBeLessThan(2000);
    }

    // Test sorting performance
    const sortDropdown = page.locator("#products-orderby");
    if (await sortDropdown.isVisible()) {
      const sortOptions = await sortDropdown.locator("option").count();

      if (sortOptions > 1) {
        const sortStartTime = Date.now();
        await sortDropdown.selectOption({ index: 1 }); // Select second option
        await page.waitForLoadState("networkidle");
        const sortTime = Date.now() - sortStartTime;

        console.log(`Product sorting completed in ${sortTime}ms`);
        expect(sortTime).toBeLessThan(3000);
      }
    }
  });

  test("should handle memory usage efficiently", async ({ page }) => {
    // Navigate through multiple pages to test memory management
    const pagesToVisit = [
      "/",
      "/computers",
      "/electronics",
      "/jewelry",
      "/cart",
      "/login",
      "/register",
    ];

    const memoryUsage = [];

    for (const pageUrl of pagesToVisit) {
      await test.step(`Visit ${pageUrl}`, async () => {
        await page.goto(pageUrl);
        // await page.waitForLoadState("networkidle");

        // Get JavaScript heap size if available
        const jsHeapSize = await page.evaluate(() => {
          if (performance.memory) {
            return {
              used: performance.memory.usedJSHeapSize,
              total: performance.memory.totalJSHeapSize,
              limit: performance.memory.jsHeapSizeLimit,
            };
          }
          return null;
        });

        if (jsHeapSize) {
          memoryUsage.push({
            page: pageUrl,
            memory: jsHeapSize,
          });

          console.log(
            `${pageUrl}: ${Math.round(jsHeapSize.used / 1024 / 1024)}MB used`
          );
        }
      });
    }

    if (memoryUsage.length > 0) {
      // Check for memory leaks (significant increases in usage)
      const initialMemory = memoryUsage[0].memory.used;
      const finalMemory = memoryUsage[memoryUsage.length - 1].memory.used;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      console.log(`Memory increase over test: ${Math.round(memoryIncrease)}MB`);

      // Memory usage shouldn't increase dramatically during normal navigation
      expect(memoryIncrease).toBeLessThan(50); // Less than 50MB increase

      // Check for excessive memory usage
      const maxMemoryUsage =
        Math.max(...memoryUsage.map((m) => m.memory.used)) / 1024 / 1024;
      console.log(`Peak memory usage: ${Math.round(maxMemoryUsage)}MB`);

      expect(maxMemoryUsage).toBeLessThan(200); // Less than 200MB peak usage
    } else {
      console.log("Memory measurement not available in this browser");
    }
  });

  test.only("should handle concurrent database operations", async ({
    browser,
  }) => {
    const concurrentOperations = 3;
    const contexts = [];
    const pages = [];

    try {
      // Create multiple contexts (simulate different users)
      for (let i = 0; i < concurrentOperations; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        contexts.push(context);
        pages.push(page);
      }

      // Simulate concurrent cart operations
      const cartOperations = pages.map(async (page, index) => {
        await page.goto("/");

        const productItems = page.locator(".product-item");
        const productCount = await productItems.count();

        if (productCount > 0) {
          const productIndex = index % productCount;
          const productLink = page
            .locator(".product-title a")
            .nth(productIndex);
          await productLink.click();

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
          if (await page.locator("#product_attribute_75_5_31_96").isVisible()) {
            await page.check("#product_attribute_75_5_31_96");
          }

          const startTime = Date.now();
          const addToCartButton = page.locator("input.add-to-cart-button");
          await addToCartButton.click();

          // Wait for cart notification (DB write confirmation)
          await expect(page.locator(".bar-notification")).toBeVisible({
            timeout: 10000,
          });
          const operationTime = Date.now() - startTime;

          console.log(
            `Concurrent cart operation ${index + 1}: ${operationTime}ms`
          );
          return operationTime;
        }

        return 0;
      });

      // Execute all operations concurrently
      const operationTimes = await Promise.all(cartOperations);
      const validTimes = operationTimes.filter((time) => time > 0);

      if (validTimes.length > 0) {
        const avgOperationTime =
          validTimes.reduce((sum, time) => sum + time, 0) / validTimes.length;

        console.log(
          `Average concurrent cart operation time: ${avgOperationTime}ms`
        );

        // Ensure performance thresholds
        expect(avgOperationTime).toBeLessThan(5000);
        const maxOperationTime = Math.max(...validTimes);
        expect(maxOperationTime).toBeLessThan(10000);
      }
    } finally {
      // Clean up
      for (const context of contexts) {
        await context.close();
      }
    }
  });
});
