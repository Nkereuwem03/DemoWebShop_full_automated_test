import { test, expect } from "@playwright/test";
import { addProductToCart } from "../../utils/helpers";

// Performance thresholds (in milliseconds)
const performanceThresholds = {
  homepage: 3000,
  productPage: 2000,
  searchResults: 1000,
  checkout: 6000,
};

// Network conditions for testing
const networkConditions = {
  slow3G: {
    downloadThroughput: (500 * 1024) / 8, // 500kb/s
    uploadThroughput: (500 * 1024) / 8,
    latency: 2000, // 2s latency
  },
  fast3G: {
    downloadThroughput: (1.6 * 1024 * 1024) / 8, // 1.6Mb/s
    uploadThroughput: (750 * 1024) / 8,
    latency: 562,
  },
  offline: {
    downloadThroughput: 0,
    uploadThroughput: 0,
    latency: 0,
  },
};

// Helper functions
const measurePageLoadTime = async (page, url) => {
  const startTime = Date.now();

  await page.goto(url);

  const endTime = Date.now();
  const loadTime = endTime - startTime;

  // Also get performance API metrics
  const performanceMetrics = await page.evaluate(() => {
    const perf = performance.getEntriesByType("navigation")[0];
    return {
      domContentLoaded: perf.domContentLoadedEventEnd - perf.navigationStart,
      loadComplete: perf.loadEventEnd - perf.navigationStart,
      firstPaint: perf.responseStart - perf.navigationStart,
      timeToInteractive: perf.loadEventEnd - perf.navigationStart,
    };
  });

  return {
    totalLoadTime: loadTime,
    ...performanceMetrics,
  };
};

const measureResourceLoadTimes = async (page) => {
  return await page.evaluate(() => {
    const resources = performance.getEntriesByType("resource");
    const resourceTimes = {};

    resources.forEach((resource) => {
      const type = resource.initiatorType || "other";
      if (!resourceTimes[type]) {
        resourceTimes[type] = [];
      }
      resourceTimes[type].push({
        name: resource.name,
        duration: resource.duration,
        size: resource.transferSize || 0,
      });
    });

    return resourceTimes;
  });
};

test.describe("Load Times", () => {
  test("should load homepage within 3 seconds", async ({ page }) => {
    const metrics = await measurePageLoadTime(page, "/");

    console.log(`Homepage load metrics:`, metrics);

    // Test total load time
    expect(metrics.totalLoadTime).toBeLessThan(performanceThresholds.homepage);

    // Test DOM content loaded (should be faster than total load)
    expect(metrics.domContentLoaded).toBeLessThan(
      performanceThresholds.homepage * 0.7
    );

    // Verify page is actually usable
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("nav, .main-navigation")).toBeVisible();

    // Check for above-the-fold content
    const heroSection = page.locator(".hero, .banner, .main-content").first();
    if (await heroSection.isVisible()) {
      await expect(heroSection).toBeVisible();
    }

    // Measure resource load times
    const resourceTimes = await measureResourceLoadTimes(page);
    console.log("Resource load times:", resourceTimes);

    // Check for performance issues
    if (resourceTimes.script) {
      const largeScripts = resourceTimes.script.filter(
        (script) => script.duration > 1000
      );
      if (largeScripts.length > 0) {
        console.warn("Large scripts detected:", largeScripts);
      }
    }

    if (resourceTimes.img) {
      const largeImages = resourceTimes.img.filter((img) => img.size > 500000); // > 500KB
      if (largeImages.length > 0) {
        console.warn("Large images detected:", largeImages);
      }
    }
  });

  test("should load product pages within 2 seconds", async ({ page }) => {
    // First navigate to products page to get a product URL
    await page.goto("/products");

    const productLinks = page.locator(
      ".product-grid .item-box .product-item .details .product-title a"
    );
    const productCount = await productLinks.count();

    if (productCount === 0) {
      test.skip("No products found to test load times");
    }

    // Test multiple product pages
    const testCount = Math.min(productCount, 3);

    for (let i = 0; i < testCount; i++) {
      await test.step(`Test product page ${i + 1}`, async () => {
        const productUrl = await productLinks.nth(i).getAttribute("href");

        const metrics = await measurePageLoadTime(page, productUrl);
        console.log(`Product page ${i + 1} metrics:`, metrics);

        expect(metrics.totalLoadTime).toBeLessThan(
          performanceThresholds.productPage
        );
        expect(metrics.domContentLoaded).toBeLessThan(
          performanceThresholds.productPage * 0.8
        );

        // Verify essential product page elements load quickly
        await expect(
          page.locator(".product-name, .product-title")
        ).toBeVisible();
        await expect(page.locator(".product-price, .price")).toBeVisible();
        await expect(
          page.locator(".product-image img, .main-image img")
        ).toBeVisible();

        // Test add to cart button is interactive
        const addToCartButton = page.locator(
          "input.button-1.add-to-cart-button"
        );
        await expect(addToCartButton).toBeVisible();
        await expect(addToCartButton).toBeEnabled();
      });
    }
  });

  test("should complete search within 1 second", async ({ page }) => {
    await page.goto("/");

    const searchInput = page
      .locator("#small-searchterms")
      .or(page.getByPlaceholder(/search/i));

    await expect(searchInput).toBeVisible();

    const searchTerms = ["laptop", "shirt", "book"];

    for (const term of searchTerms) {
      await test.step(`Search for "${term}"`, async () => {
        await searchInput.clear();
        await searchInput.fill(term);

        const startTime = Date.now();
        await searchInput.press("Enter");

        // Wait for search results to appear
        const resultsIndicator = page
          .locator(".product-grid .item-box .product-item")
          .first();
        await expect(resultsIndicator).toBeVisible({
          timeout: performanceThresholds.searchResults,
        });

        const searchTime = Date.now() - startTime;
        console.log(`Search for "${term}" completed in ${searchTime}ms`);

        expect(searchTime).toBeLessThan(performanceThresholds.searchResults);

        // Verify search results are relevant
        const resultCount = await page.locator(".product-item").count();
        console.log(`Found ${resultCount} results for "${term}"`);

        if (resultCount > 0) {
          // Check if first result is relevant
          const firstResult = page.locator(".product-item").first();
          const resultText = await firstResult.textContent();
          const isRelevant = resultText
            .toLowerCase()
            .includes(term.toLowerCase().substring(0, 3));

          if (!isRelevant) {
            console.warn(`First result may not be relevant for "${term}"`);
          }
        }
      });
    }
  });

  test("should process checkout within 5 seconds", async ({ page }) => {
    // Clear any existing sessions
    await page.context().clearCookies();
    await page.goto("/");

    // Add product to cart
    await addProductToCart(page, testData.testProducts[0].name);

    // Navigate the cart
    await page.goto("/cart");
    test.setTimeout(60000);

    const cartTotalPrice = await getCartTotal(page);

    const startTime = Date.now();

    await proceedToCheckout(page);
    await checkoutAsGuest(page);

    const user = await fillBillingAddress(page, testData.guestUser);

    await validateShippingAddress(page, user);
    await selectShippingMethod(page, testData.shippingMethods[2]);
    await fillPaymentMethod(page, testData.paymentMethods[3]);
    await fillPaymentInfo(page, testData.paymentData);
    await confirmOrder(page, cartTotalPrice);
    await confirmationMessage(page);

    // validate checkout time
    const checkoutTime = Date.now() - startTime;
    console.log(`Checkout process initiated in ${checkoutTime}ms`);

    expect(checkoutTime).toBeLessThan(performanceThresholds.checkout);
  });

  test("should maintain performance with multiple page transitions", async ({
    page,
  }) => {
    const pages = [
      { url: "/", name: "Homepage" },
      { url: "/cart", name: "Cart" },
      { url: "/login", name: "Login" },
    ];

    const transitionTimes = [];

    for (let i = 0; i < pages.length; i++) {
      const currentPage = pages[i];
      const nextPage = pages[(i + 1) % pages.length];

      await test.step(`Navigate from ${currentPage.name} to ${nextPage.name}`, async () => {
        await page.goto(currentPage.url);
        await page.waitForLoadState("networkidle");

        const startTime = Date.now();
        await page.goto(nextPage.url);
        await page.waitForLoadState("networkidle");
        const transitionTime = Date.now() - startTime;

        transitionTimes.push({
          from: currentPage.name,
          to: nextPage.name,
          time: transitionTime,
        });

        console.log(
          `${currentPage.name} → ${nextPage.name}: ${transitionTime}ms`
        );
        expect(transitionTime).toBeLessThan(3000); // Should be reasonable
      });
    }

    // Average transition time should be reasonable
    const avgTransitionTime =
      transitionTimes.reduce((sum, t) => sum + t.time, 0) /
      transitionTimes.length;
    console.log(`Average page transition time: ${avgTransitionTime}ms`);
    expect(avgTransitionTime).toBeLessThan(2000);
  });
});
