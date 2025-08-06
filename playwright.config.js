const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 120000, // 2 minutes per test
  expect: {
    timeout: 15000
  },
  retries: process.env.CI ? 2 : 1,
  workers: 1, // Sequential execution to avoid port conflicts
  reporter: process.env.CI ? [
    ['junit', { outputFile: 'junit.xml' }],
    ['html', { open: 'never' }]
  ] : [['list'], ['html', { open: 'never' }]],
  
  use: {
    actionTimeout: 15000,
    navigationTimeout: 30000,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Helpful for debugging iframe issues
    viewport: { width: 1280, height: 720 }
  },
  
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: {
          // These args help with iframe payment forms
          args: [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-ipc-flooding-protection'
          ]
        }
      }
    }
  ],
  
  // Global setup/teardown
  globalSetup: require.resolve('./tests/global-setup.js'),
  globalTeardown: require.resolve('./tests/global-teardown.js')
});