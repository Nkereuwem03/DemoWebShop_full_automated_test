import { test, expect } from "@playwright/test";

test.describe("health-check.spec.js", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("https://demowebshop.tricentis.com/");
    await expect(page).toHaveTitle("Demo Web Shop");
  });
      
  test("should connect to database", async ({ page }) => {
   
  });

  test("should access payment gateway", async ({ page }) => {
   
  });

  test("should load all essential pages", async ({ page }) => {
    
  });
});
