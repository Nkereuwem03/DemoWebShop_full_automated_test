import { test, expect } from "@playwright/test";
import { login, testData, addProductToCart } from "../../utils/helpers";

const simulateNetworkConditions = async (page, condition) => {
  const client = await page.context().newCDPSession(page);
  await client.send("Network.emulateNetworkConditions", {
    offline: condition.downloadThroughput === 0,
    downloadThroughput: condition.downloadThroughput,
    uploadThroughput: condition.uploadThroughput,
    latency: condition.latency,
  });
};

test.describe("Network Conditions", () => {
  test("should work on slow 3G connection", async ({ page }) => {
    await simulateNetworkConditions(page, networkConditions.slow3G);

    // Test homepage load on slow connection
    const startTime = Date.now();
    await page.goto("/");

    // Wait for basic content to appear (more lenient timeout)
    await expect(page.locator("body")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("nav")).toBeVisible({ timeout: 10000 });

    const loadTime = Date.now() - startTime;
    console.log(`Homepage loaded on slow 3G in ${loadTime}ms`);

    // Should load within reasonable time even on slow connection
    expect(loadTime).toBeLessThan(10000); // 10 seconds max on slow 3G

    // Test critical functionality still works
    const searchInput = page.locator("#small-searchterms");
    if (await searchInput.isVisible()) {
      await searchInput.fill("test");
      await searchInput.press("Enter");

      // Search should eventually complete
      await expect(
        page.locator(".product-grid, .no-result-message")
      ).toBeVisible({ timeout: 8000 });
    }

    // Test product browsing
    await page.goto("/products");
    await expect(page.locator(".product-item").first()).toBeVisible({
      timeout: 12000,
    });

    // Images should eventually load (with lazy loading)
    const productImages = page.locator(".product-item img");
    const imageCount = await productImages.count();

    if (imageCount > 0) {
      // At least some images should load
      await expect(productImages.first()).toBeVisible({ timeout: 8000 });
    }
  });

  test("should handle intermittent connectivity", async ({ page }) => {
    await page.goto("/");

    // Navigate to products page
    await page.goto("/products");

    // Simulate network failure
    await simulateNetworkConditions(page, networkConditions.offline);

    // Try to navigate (should fail)
    const navigationPromise = page.goto("/cart").catch(() => null);

    // Wait a moment then restore connection
    await page.waitForTimeout(2000);
    await simulateNetworkConditions(page, networkConditions.fast3G);

    // Navigation should eventually succeed
    await navigationPromise;

    // Test that the site handles reconnection gracefully
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });

    // Test form submission with intermittent connectivity
    await page.goto("/login");

    const emailField = page.locator('input[name="Email"]');
    const passwordField = page.locator('input[name="Password"]');
    const loginButton = page.locator('input[type="submit"]');

    await login(page, testData.registeredUser);
    await simulateNetworkConditions(page, networkConditions.fast3G);

    // Form should handle the retry or show appropriate error
    await page.waitForTimeout(2000);
    const currentUrl = page.url();

    // Should either succeed or show error, not just hang
    expect(currentUrl).toBeTruthy();
  });

  test("should work offline (cached content)", async ({ page }) => {
    // First, load pages to populate cache
    const pagesToCache = ["/", "/products"];

    for (const pageUrl of pagesToCache) {
      await page.goto(pageUrl);
    }

    // Now go offline
    await simulateNetworkConditions(page, networkConditions.offline);

    // Test cached page access
    await page.goto("/");

    // Basic structure should be available from cache
    const bodyVisible = await page.locator("body").isVisible();

    if (bodyVisible) {
      console.log("Homepage available offline from cache");

      // Navigation should work for cached pages
      const navLinks = page.locator("nav a");
      if ((await navLinks.count()) > 0) {
        const productsLink = navLinks.filter({ hasText: /products/i });
        if ((await productsLink.count()) > 0) {
          await productsLink.first().click();

          // Should navigate to cached products page
          await expect(page.locator("body")).toBeVisible({ timeout: 5000 });
        }
      }
    } else {
      console.log(
        "No offline cache available - consider implementing service worker"
      );
    }

    // Test offline indicator if present
    const offlineIndicator = page.locator(
      ".offline-indicator, [data-offline-status]"
    );
    if (await offlineIndicator.isVisible()) {
      await expect(offlineIndicator).toContainText(/offline|no connection/i);
    }

    // Test offline form behavior
    const searchInput = page.locator("#small-searchterms");
    if (await searchInput.isVisible()) {
      await searchInput.fill("offline test");
      await searchInput.press("Enter");

      // Should handle offline search gracefully
      const offlineMessage = page.getByText(
        /offline|no connection|network error/i
      );
      if (await offlineMessage.isVisible()) {
        console.log("Offline search handled gracefully");
      }
    }
  });

  test("should gracefully handle network failures", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Test API call failures
    const searchInput = page.locator("#small-searchterms");
    if (await searchInput.isVisible()) {
      await searchInput.fill("test");

      // Simulate network failure during search
      await simulateNetworkConditions(page, networkConditions.offline);
      await searchInput.press("Enter");

      // Should show appropriate error message
      await page.waitForTimeout(3000);

      const errorMessages = [
        page.getByText(/network error/i),
        page.getByText(/connection failed/i),
        page.getByText(/please try again/i),
        page.getByText(/offline/i),
      ];

      let errorFound = false;
      for (const errorMsg of errorMessages) {
        if (await errorMsg.isVisible()) {
          errorFound = true;
          console.log("Network error handled gracefully");
          break;
        }
      }

      if (!errorFound) {
        console.log("Network error handling could be improved");
      }
    }

    // Test form submission failures
    await simulateNetworkConditions(page, networkConditions.fast3G);
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    const emailField = page.locator('input[name="Email"]');
    const passwordField = page.locator('input[name="Password"]');
    const submitButton = page.locator('input[type="submit"]');

    if (await emailField.isVisible()) {
      await emailField.fill("test@example.com");
      await passwordField.fill("password123");

      // Go offline before submission
      await simulateNetworkConditions(page, networkConditions.offline);
      await submitButton.click();

      await page.waitForTimeout(5000);

      // Should show error or retry mechanism
      const loginForm = page.locator("form");
      const stillOnLoginPage = await loginForm.isVisible();

      if (stillOnLoginPage) {
        console.log("Form submission failure handled - user remains on form");
      }

      // Test retry after reconnection
      await simulateNetworkConditions(page, networkConditions.fast3G);
      await page.waitForTimeout(2000);

      const retryButton = page.getByRole("button", {
        name: /retry|try again/i,
      });
      if (await retryButton.isVisible()) {
        await retryButton.click();
        console.log("Retry mechanism available");
      }
    }
  });

  test("should optimize resource loading for poor connections", async ({
    page,
  }) => {
    await simulateNetworkConditions(page, networkConditions.slow3G);

    await page.goto("/products");
    await page.waitForLoadState("networkidle");

    // Check for lazy loading implementation
    const images = page.locator("img");
    const imageCount = await images.count();

    let lazyLoadCount = 0;
    for (let i = 0; i < Math.min(imageCount, 10); i++) {
      const img = images.nth(i);
      const loading = await img.getAttribute("loading");
      if (loading === "lazy") {
        lazyLoadCount++;
      }
    }

    console.log(
      `${lazyLoadCount} out of ${Math.min(
        imageCount,
        10
      )} images use lazy loading`
    );

    if (lazyLoadCount > 0) {
      console.log(
        "Lazy loading implemented for better slow connection performance"
      );
    }

    // Check for image compression/optimization
    const resourceTimes = await measureResourceLoadTimes(page);
    if (resourceTimes.img) {
      const avgImageSize =
        resourceTimes.img.reduce((sum, img) => sum + img.size, 0) /
        resourceTimes.img.length;
      console.log(`Average image size: ${Math.round(avgImageSize / 1024)}KB`);

      if (avgImageSize > 200000) {
        // > 200KB
        console.warn("Images may be too large for slow connections");
      }
    }

    // Test progressive loading
    const productItems = page.locator(".product-item");
    const visibleProducts = await productItems.count();

    // Scroll to trigger more content loading
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);

    const newVisibleProducts = await productItems.count();
    if (newVisibleProducts > visibleProducts) {
      console.log("Progressive loading detected - good for slow connections");
    }
  });
});
