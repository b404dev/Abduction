import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import assert from "node:assert/strict";
import { Builder, By, Key, until } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";

const root = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const host = "127.0.0.1";
const port = 4173;
const baseUrl = `http://${host}:${port}/e2e/?fresh=1`;

async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.ok || response.status === 304) return;
    } catch {
      // keep waiting
    }
    await delay(300);
  }
  throw new Error(`Vite server did not become ready at ${url}`);
}

function startServer() {
  const server = spawn("npm", ["run", "dev", "--", "--host", host, "--port", String(port), "--strictPort"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, CI: "1" },
  });
  server.stdout.on("data", (chunk) => process.stdout.write(chunk));
  server.stderr.on("data", (chunk) => process.stderr.write(chunk));
  return server;
}

async function run() {
  const server = startServer();
  try {
    await waitForServer(`http://${host}:${port}/e2e/`);

    const options = new chrome.Options()
      .addArguments("--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--window-size=1600,1200");

    const driver = await new Builder().forBrowser("chrome").setChromeOptions(options).build();
    try {
      await driver.get(baseUrl);

      const splash = await driver.wait(until.elementLocated(By.css("main.splash")), 10_000);
      assert.match(await splash.getAttribute("aria-label"), /Starting Abduction/);
      await driver.executeScript("window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))");

      await driver.wait(until.elementLocated(By.css("div.shell")), 10_000);
      await driver.wait(until.elementLocated(By.xpath("//h1[text()='Abduction']")), 10_000);

      const beginEncounter = await driver.wait(until.elementLocated(By.xpath("//button[text()='Begin encounter']")), 10_000);
      await beginEncounter.click();
      await driver.wait(async () => (await driver.findElements(By.css(".guide-backdrop"))).length === 0, 10_000);

      const codeButton = await driver.findElement(By.css("nav[aria-label='Primary navigation'] button[aria-label^='Code']"));
      await codeButton.click();

      const search = await driver.findElement(By.css("input[aria-label='Search repository']"));
      await search.sendKeys("read");
      await driver.wait(until.elementLocated(By.xpath("//div[contains(@class,'search-results')]//strong[text()='README.md']")), 10_000);
      await driver.findElement(By.xpath("//div[contains(@class,'search-results')]//button[.//strong[text()='README.md']]")) .click();
      await driver.wait(until.elementLocated(By.xpath("//h2[text()='README.md']")), 10_000);

      const themesButton = await driver.findElement(By.css("nav[aria-label='Primary navigation'] button[aria-label^='Themes']"));
      await themesButton.click();
      const lostMary = await driver.findElement(By.xpath("//button[.//strong[text()='Lost Mary']]"));
      await lostMary.click();
      assert.equal(await driver.executeScript("return document.documentElement.dataset.theme"), "lost-mary");
      assert.equal(await driver.executeScript("return localStorage.getItem('reaper-theme')"), "lost-mary");

      const settingsButton = await driver.findElement(By.css("nav[aria-label='Primary navigation'] button[aria-label^='Settings']"));
      await settingsButton.click();
      const workspaceField = await driver.findElement(By.xpath("//label[.//span[text()='Repository workspace']]//input"));
      await workspaceField.clear();
      await workspaceField.sendKeys("/tmp/abduction-e2e-workspace");
      const editorField = await driver.findElement(By.xpath("//label[.//span[text()='Editor command']]//input"));
      await editorField.clear();
      await editorField.sendKeys("zed");
      const saveButton = await driver.findElement(By.xpath("//button[contains(., 'Save')]"));
      await saveButton.click();
      await driver.wait(async () => (await workspaceField.getAttribute("value")) === "/tmp/abduction-e2e-workspace", 10_000);
      assert.equal(await driver.executeScript("return document.documentElement.dataset.theme"), "lost-mary");

      console.log("Selenium smoke suite passed.");
    } finally {
      await driver.quit();
    }
  } finally {
    server.kill("SIGTERM");
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
