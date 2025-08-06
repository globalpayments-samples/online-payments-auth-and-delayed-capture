const { test, expect } = require('@playwright/test');
const testData = require('./test-data.json');
const { spawn } = require('child_process');
const fetch = require('node-fetch');
const path = require('path');

let server;

async function isPortFree(port) {
  try {
    const response = await fetch(`http://localhost:${port}`, { timeout: 1000 });
    return false;
  } catch (error) {
    return true;
  }
}

async function forceKillPortProcesses(port) {
  try {
    const { spawn } = require('child_process');
    
    // Find processes using the port
    const lsof = spawn('lsof', ['-ti', `tcp:${port}`]);
    
    return new Promise((resolve) => {
      let pids = '';
      lsof.stdout.on('data', (data) => {
        pids += data.toString();
      });
      
      lsof.on('close', (code) => {
        if (pids.trim()) {
          const pidList = pids.trim().split('\n');
          
          pidList.forEach(pid => {
            try {
              process.kill(parseInt(pid), 'SIGKILL');
              console.log(`🔫 Killed process ${pid} on port ${port}`);
            } catch (e) {
              // Process might already be dead
            }
          });
        }
        resolve();
      });
      
      lsof.on('error', () => resolve()); // Handle lsof not found
    });
  } catch (error) {
    console.log('⚠️  Error in forceKillPortProcesses:', error.message);
  }
}

async function waitForPortToFree(port, maxWait = 15000) {
  console.log(`⏳ Waiting for port ${port} to become free...`);
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    if (await isPortFree(port)) {
      console.log(`✅ Port ${port} is now free`);
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`🔫 Port ${port} still not free, forcing cleanup...`);
  await forceKillPortProcesses(port);
  
  // Final check after force cleanup
  await new Promise(resolve => setTimeout(resolve, 2000));
  if (await isPortFree(port)) {
    console.log(`✅ Port ${port} freed after force cleanup`);
    return true;
  }
  
  throw new Error(`❌ Port ${port} did not become free even after force cleanup`);
}

async function startServer(impl, serverConfig) {
  console.log(`🚀 Starting ${impl} server...`);
  
  // First ensure port 8000 is free
  await waitForPortToFree(8000);
  
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = serverConfig.command.split(' ');
    
    const options = {
      shell: true,
      detached: true,
      stdio: 'pipe',
      cwd: path.join(__dirname, '..', '..'),
      env: {
        ...process.env,
        NODE_OPTIONS: '--experimental-vm-modules --no-warnings',
        PORT: '8000'
      }
    };

    server = spawn(cmd, args, options);

    // Capture server output for debugging
    let serverOutput = '';
    let serverErrors = '';

    server.stdout.on('data', (data) => {
      const output = data.toString();
      serverOutput += output;
      console.log(`[${impl} STDOUT]:`, output.trim());
    });

    server.stderr.on('data', (data) => {
      const output = data.toString();
      serverErrors += output;
      console.log(`[${impl} STDERR]:`, output.trim());
    });

    server.on('error', (error) => {
      console.error(`❌ Server spawn error for ${impl}:`, error);
      reject(error);
    });

    server.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        console.error(`❌ Server ${impl} exited with code ${code}, signal ${signal}`);
      }
    });

    // Wait for server to be ready with increased retries
    let retries = 0;
    const maxRetries = 15; // Increased from 10
    
const checkServer = async () => {
  try {
    console.log(`🔍 Health check ${retries + 1}/${maxRetries} for ${impl}...`);
    
    // Try IPv4 first, then IPv6 if that fails
    const urls = [
      `http://127.0.0.1:8000${serverConfig.configEndpoint}`,
      `http://[::1]:8000${serverConfig.configEndpoint}`,
      `${serverConfig.url}${serverConfig.configEndpoint}`
    ];
    
    let lastError;
    for (const url of urls) {
      try {
        const response = await fetch(url, {
          timeout: 5000,
          headers: { 'User-Agent': 'Playwright-Test-Health-Check' }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        if (data.success && data.data && (data.data.publicApiKey || data.data.accessToken)) {
          console.log(`✅ ${impl} server is ready at ${url}!`);
          resolve(server);
          return;
        }
        
        throw new Error('Server not fully initialized - missing publishable credential');
      } catch (error) {
        lastError = error;
        console.log(`⚠️  Failed to connect to ${url}: ${error.message}`);
        continue; // Try next URL
      }
    }
    
    // If we get here, all URLs failed
    throw lastError;
  } catch (error) {
    console.log(`⚠️  Health check failed for ${impl}: ${error.message}`);
    
    if (++retries === maxRetries) {
      console.error(`❌ ${impl} server failed to start after ${maxRetries} attempts`);
      console.error(`📋 Server output:`, serverOutput);
      console.error(`📋 Server errors:`, serverErrors);
      reject(new Error(`Server failed to start: ${error.message}`));
      return;
    }
    
    // Progressive backoff
    const delay = Math.min(2000 + (retries * 300), 4000);
    await new Promise(resolve => setTimeout(resolve, delay));
    checkServer();
  }
};
    
    // Start checking after initial delay
    setTimeout(checkServer, 3000);
  });
}

async function stopServer() {
  if (server) {
    console.log('🛑 Stopping server...');
    try {
      // Kill the process group (negative PID)
      if (server.pid) {
        process.kill(-server.pid, 'SIGTERM');
      }
      
      // Wait for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Force kill if still running
      try {
        if (server.pid) {
          process.kill(-server.pid, 'SIGKILL');
        }
      } catch (e) {
        // Process likely already dead
      }
    } catch (error) {
      console.log('⚠️  Error stopping server:', error.message);
    }
    
    // Additional cleanup
    await new Promise(resolve => setTimeout(resolve, 2000));
    await forceKillPortProcesses(8000);
    
    server = null;
    console.log('✅ Server cleanup completed');
  }
}

// Helper function to handle form submission and response
async function submitAndWaitForResponse(page) {
  console.log('📤 Starting form submission...');
  
  // Create a promise to wait for the response
  const responsePromise = page.waitForResponse(response => {
    const isPaymentEndpoint = response.url().includes('/process-payment');
    console.log(`🔍 Checking response: ${response.url()}, isPayment: ${isPaymentEndpoint}`);
    return isPaymentEndpoint;
  }, { timeout: 45000 }); // Increased timeout

  // Submit through iframe button
  const submitFrame = page.frameLocator('iframe[id*="submit"]').first();
  const submitButton = submitFrame.locator('button[type="button"]');
  
  // Wait for button to be ready with retry
  let buttonReady = false;
  for (let i = 0; i < 5; i++) {
    try {
      await submitButton.waitFor({ state: 'visible', timeout: 5000 });
      await submitButton.waitFor({ state: 'attached', timeout: 5000 });
      buttonReady = true;
      break;
    } catch (e) {
      console.log(`⚠️  Submit button not ready, attempt ${i + 1}/5`);
      await page.waitForTimeout(1000);
    }
  }
  
  if (!buttonReady) {
    throw new Error('❌ Submit button never became ready');
  }
  
  console.log('🖱️  Clicking submit button...');
  await submitButton.click();

  try {
    const response = await responsePromise;
    console.log(`✅ Received response: ${response.status()}`);
    return response;
  } catch (error) {
    console.error('❌ Form submission failed:', error.message);
    throw error;
  }
}

// Helper function to fill form fields
async function fillPaymentForm(page, cardData) {
  console.log('📝 Filling payment form...');
  
  // Wait for required iframes
  const requiredIframeSelectors = [
    'iframe[id*="card-number"]',
    'iframe[id*="expiration"]',
    'iframe[id*="cvv"]',
    'iframe[id*="submit"]'
  ];

  for (const selector of requiredIframeSelectors) {
    console.log(`⏳ Waiting for iframe: ${selector}`);
    await page.waitForSelector(selector, { timeout: 20000 });
  }

  // Check for optional cardholder name iframe
  const cardholderIframeExists = await page.locator('iframe[id*="card-holder"]').count() > 0;

  // Additional wait for iframe content to load
  console.log('⏳ Waiting for iframe content to load...');
  await page.waitForTimeout(2000);

  try {
    // Fill card number
    console.log('💳 Filling card number...');
    const cardNumberFrame = page.frameLocator('iframe[id*="card-number"]').first();
    await cardNumberFrame.locator('input[id*="field"]').fill(cardData.number);

    // Fill expiration date
    console.log('📅 Filling expiration date...');
    const expDateFrame = page.frameLocator('iframe[id*="expiration"]').first();
    await expDateFrame.locator('input[id*="field"]').fill(`${cardData.expMonth}${cardData.expYear}`);

    // Fill CVV
    console.log('🔒 Filling CVV...');
    const cvvFrame = page.frameLocator('iframe[id*="cvv"]').first();
    await cvvFrame.locator('input[id*="field"]').fill(cardData.cvv);

    // Fill cardholder name if iframe exists
    if (cardholderIframeExists) {
      console.log('👤 Filling cardholder name...');
      const cardholderFrame = page.frameLocator('iframe[id*="card-holder"]').first();
      await cardholderFrame.locator('input[id*="field"]').fill(cardData.cardholderName);
    } else {
      console.log('⚠️  Cardholder name iframe not found, skipping...');
    }
    
    console.log('✅ Payment form filled successfully');
  } catch (error) {
    console.error('❌ Error filling payment form:', error.message);
    throw error;
  }
}

// Get implementation filter from environment or test all
const IMPLEMENTATION_FILTER = process.env.IMPLEMENTATION_FILTER;
const implementationsToTest = IMPLEMENTATION_FILTER 
  ? { [IMPLEMENTATION_FILTER]: testData.testServers[IMPLEMENTATION_FILTER] }
  : testData.testServers;

// Test each server implementation
for (const [impl, serverConfig] of Object.entries(implementationsToTest)) {
  test.describe(`${impl} implementation`, () => {
    test.beforeAll(async () => {
      await startServer(impl, serverConfig);
    });

    test.afterAll(async () => {
      await stopServer();
    });

    test(`complete payment flow for ${impl}`, async ({ page }) => {
      test.setTimeout(90000); // 90 seconds
      
      // Enable console logging for debugging
      page.on('console', msg => console.log(`[BROWSER]: ${msg.text()}`));
      
      // Navigate to payment page
      await test.step('Navigate to payment page', async () => {
        console.log(`🌐 Navigating to ${serverConfig.url}`);
        await page.goto(serverConfig.url, { timeout: 30000 });
        await expect(page).toHaveTitle('Global Payments - Developer Example');
        console.log('✅ Payment page loaded successfully');
      });

      // Enter billing zip and fill form
      await test.step('Fill payment form', async () => {
        await page.fill('#amount', testData.amount);
        await page.fill('#billing_zip', testData.billingInfo.zipCode);
        await fillPaymentForm(page, testData.validCard);
      });

      // Submit and verify
      await test.step('Submit and verify', async () => {
        const response = await submitAndWaitForResponse(page);
        expect(response.status()).toBe(200);
        
        const data = await response.json();
        console.log('💰 Payment response:', data);
        
        // auth
        expect(data[0].success).toBe(true);
        expect(data[0].data.transactionId).toBeDefined();
        
        // capture
        expect(data[1].success).toBe(true);
        expect(data[1].data.transactionId).toBeDefined();
      });
    });

    test(`handles payment decline for ${impl}`, async ({ page }) => {
      test.setTimeout(90000);
      
      console.log(`🚫 Testing payment decline for ${impl}`);
      await page.goto(serverConfig.url);
      await page.fill('#amount', testData.amount);
      await page.fill('#billing_zip', testData.billingInfo.zipCode);
      await fillPaymentForm(page, testData.declineCard);

      const response = await submitAndWaitForResponse(page);
      expect(response.status()).toBe(400);
      
      const data = await response.json();
      console.log('🚫 Decline response:', data);
      
      expect(data.success).toBe(false);
      expect(data.error || data.message).toBeDefined();
    });
  });
}