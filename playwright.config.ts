import { defineConfig, devices } from "@playwright/test";

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const localBaseUrl = "http://localhost:3010";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results/native-navigation",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [["list"]],
  use: {
    baseURL: externalBaseUrl ?? localBaseUrl,
    browserName: "chromium",
    locale: "zh-CN",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command:
          "npm run build && npm run start -- --hostname localhost --port 3010",
        url: localBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    {
      name: "iphone-14",
      use: {
        ...devices["iPhone 14"],
        browserName: "chromium",
      },
    },
    {
      name: "iphone-15-pro-max",
      use: {
        ...devices["iPhone 15 Pro Max"],
        browserName: "chromium",
      },
    },
  ],
});
