import { test, expect } from "@playwright/test";

const APP = "/grand-prix/app/";

async function openEditor(page, params = "") {
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(APP + params);

    // Monaco is ready when the view-lines element appears
    await page.waitForSelector(".monaco-editor .view-lines", {
        timeout: 25000,
    });

    return errors;
}

// Open the F1 command palette and execute an action by typing its label,
// then pressing Enter on the top-filtered result.
async function runCommand(page, actionLabel) {
    await page.locator(".monaco-editor").click();
    await page.keyboard.press("F1");
    await page.keyboard.type(actionLabel);
    // Wait for at least one list entry to appear before accepting
    await page
        .locator(".quick-input-list .quick-input-list-entry")
        .first()
        .waitFor({ timeout: 5000 });
    await page.keyboard.press("Enter");
}

// ---------- App load ----------

test("app loads without JavaScript errors", async ({ page }) => {
    const errors = await openEditor(page);
    expect(errors).toEqual([]);
});

test("Monaco editor mounts and is visible", async ({ page }) => {
    await openEditor(page);
    await expect(page.locator(".monaco-editor")).toBeVisible();
});

// ---------- Editor interaction ----------

test("typing in the editor shows gutter changed-markers", async ({ page }) => {
    await openEditor(page);
    await page.locator(".monaco-editor").click();
    await page.keyboard.press("End");
    await page.keyboard.type("x");
    await expect(page.locator(".edit-margin-changed").first()).toBeVisible();
});

// ---------- Commands ----------

test("command palette opens with F1", async ({ page }) => {
    await openEditor(page);
    await page.locator(".monaco-editor").click();
    await page.keyboard.press("F1");
    await expect(page.locator(".quick-input-widget")).toBeVisible();
    await page.keyboard.press("Escape");
});

test("language picker opens and changes Monaco language mode", async ({
    page,
}) => {
    const errors = await openEditor(page);
    await runCommand(page, "Change Language");

    // Our language picker (second QuickInput) should now be visible
    const quickInput = page.locator(".quick-input-widget");
    await expect(quickInput).toBeVisible();

    // Filter for Python and accept
    await page.keyboard.type("python");
    await page
        .locator(".quick-input-list .quick-input-list-entry")
        .first()
        .waitFor({ timeout: 5000 });
    await page.keyboard.press("Enter");

    // Editor should still be functional after language change
    await page.locator(".monaco-editor").click();
    await page.keyboard.type("y");
    expect(errors).toEqual([]);
});

test("theme picker opens and applies a theme", async ({ page }) => {
    await openEditor(page);
    await runCommand(page, "Change Theme");

    const quickInput = page.locator(".quick-input-widget");
    await expect(quickInput).toBeVisible();

    // Pick High Contrast
    await page.keyboard.type("High Contrast");
    await page
        .locator(".quick-input-list .quick-input-list-entry")
        .first()
        .waitFor({ timeout: 5000 });
    await page.keyboard.press("Enter");

    // Monaco root reflects the hc-black class
    await expect(page.locator(".monaco-editor.hc-black")).toBeVisible();
});

test("autocomplete picker opens and accepts a selection", async ({ page }) => {
    const errors = await openEditor(page);
    expect(errors, "no JS errors on load").toEqual([]);

    await runCommand(page, "Configure Autocomplete");

    // Picker should be visible with our custom options
    const quickInput = page.locator(".quick-input-widget");
    await expect(quickInput).toBeVisible();

    // Verify the three options using the labeled listbox (avoids substring collisions
    // with the message text). Accessible name includes description so use substring match.
    const listbox = page.getByRole("listbox", { name: /Autocomplete/ });
    await expect(listbox.getByRole("option", { name: "Auto" })).toBeVisible();
    await expect(listbox.getByRole("option", { name: "On" })).toBeVisible();
    await expect(listbox.getByRole("option", { name: "Off" })).toBeVisible();

    // Select "On" and verify the config was actually persisted
    await page.keyboard.type("On");
    await page
        .locator(".quick-input-list .quick-input-list-entry")
        .first()
        .waitFor({ timeout: 5000 });
    await page.keyboard.press("Enter");

    // Dismiss first-change sign-in prompt if it appears (fires because config changed)
    const notNow = page.getByRole("button", { name: "Not now" });
    if (await notNow.isVisible({ timeout: 2000 }).catch(() => false)) {
        await notNow.click();
    }

    // Verify the autocomplete override was written to localStorage
    const stored = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("grandPrix.config") || "{}")
    );
    expect(stored.autocompleteByLanguage?.plaintext).toBe("on");
    expect(errors).toEqual([]);
});

test("word wrap toggle writes to localStorage", async ({ page }) => {
    test.setTimeout(45000);

    const errors = await openEditor(page);
    page.on("pageerror", (err) => errors.push(err.message));

    await page.locator(".monaco-editor").click();
    await page.keyboard.press("Alt+h");

    await page.waitForTimeout(300);
    expect(errors).toEqual([]);

    // Verify the config was actually updated, not just that no error was thrown
    const stored = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("grandPrix.config") || "{}")
    );
    expect(stored.wordWrap).toBe("on");
});

test("Save Locally triggers a download", async ({ page }) => {
    await openEditor(page);
    await page.locator(".monaco-editor").click();
    await page.keyboard.type("download me");

    const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.keyboard.press("Control+Shift+S"),
    ]);

    expect(download).toBeTruthy();
    expect(download.suggestedFilename()).toBe("untitled.txt");
});

// ---------- Dev-mode UI ----------

test("connect banner is visible and can be dismissed", async ({ page }) => {
    await openEditor(page);

    const banner = page.locator("#connect-banner.visible");
    await expect(banner).toBeVisible();

    await page.locator("button.banner-dismiss").click();

    await expect(page.locator("#connect-banner.visible")).toHaveCount(0);
    const dismissed = await page.evaluate(() =>
        localStorage.getItem("grandPrix.signInDismissed")
    );
    expect(dismissed).toBe("1");
});

test("devfile param sets document title", async ({ page }) => {
    await openEditor(page, "?devfile=main.py");
    await expect(page).toHaveTitle(/main\.py/);
});
