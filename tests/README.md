# E2E Tests for Card Payment Implementations

This directory contains end-to-end tests that verify the functionality of card payment processing across all implementations (Node.js, Python, PHP, Java, .NET, and Go).

## Setup

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers:
```bash
npx playwright install chromium
```

3. Set up environment:
```bash
npm run setup:env
```

## Running Tests

Run all tests:
```bash
npm test
```

Run tests for specific implementations:
```bash
npm run test:nodejs    # Test Node.js implementation
npm run test:python    # Test Python implementation
npm run test:php       # Test PHP implementation
npm run test:java      # Test Java implementation
npm run test:go        # Test Go implementation
npm run test:dotnet    # Test .NET implementation
```

Run tests in different modes:
```bash
npm run test:headed    # Run with browser UI visible
npm run test:debug     # Run in debug mode
npm run test:ui        # Run with Playwright UI
npm run test:verbose   # Run with verbose output
```

## Test Coverage

The tests verify:

1. **Complete Payment Flow**
   - Page loads successfully
   - Form fields can be filled out
   - Payment submission works
   - Success/failure responses display correctly

2. **Error Handling**
   - Invalid zip code handling
   - Payment form validation
   - Payment decline scenarios

3. **Cross-Implementation Compatibility**
   - All implementations handle the same test cases
   - Consistent API responses across languages
   - Uniform error handling

## Supported Implementations

| Implementation | Language/Framework | Port | Config Endpoint |
|---------------|-------------------|------|-----------------|
| Node.js       | Express.js        | 8000 | `/config`       |
| Python        | Flask             | 8000 | `/config`       |
| PHP           | Native PHP        | 8000 | `/config.php`   |
| Java          | Jakarta EE        | 8000 | `/config`       |
| Go            | Native Go         | 8000 | `/config`       |
| .NET          | ASP.NET Core      | 8000 | `/config`       |

## Test Structure

```
tests/
  └── e2e/
      ├── payment-flow.test.js   # Main test file
      └── test-data.json        # Test data configuration
  ├── global-setup.js           # Global test setup
  ├── global-teardown.js        # Global test cleanup
  └── README.md                 # This file
```

## CI Integration

GitHub Actions workflow is configured to:
- Run tests on push to main branch
- Run tests on pull requests
- Test all implementations in parallel
- Generate and upload test reports
- Support manual workflow dispatch with implementation selection

## Environment Requirements

- Node.js 18 or higher
- Each implementation's prerequisites:
  - .NET: .NET 9.0 SDK
  - Go: Go 1.23+
  - Java: JDK 21+
  - Python: Python 3.11+
  - PHP: PHP 8.3+
- Correct environment variables (see .env.sample files)

## Adding New Tests

When adding new tests:
1. Use the existing test patterns in payment-flow.test.js
2. Add test data to test-data.json if needed
3. Ensure tests work across all implementations
4. Add appropriate error handling and assertions
5. Update this README if adding new test categories

## Troubleshooting

Common issues and solutions:

1. **Port conflicts**: Tests automatically clean up port 8000 between runs
2. **Server startup timeouts**: Increase timeout in test configuration if needed
3. **Implementation-specific issues**: Check individual implementation logs in CI artifacts
4. **Browser issues**: Ensure Playwright browsers are installed with `npx playwright install`

## Test Data

The tests use predefined test data for consistency:
- Valid card: 4242424242424242 (Visa test card)
- Test amounts: $10.00 (success), $10.08 (decline)
- Billing zip: 12345

See `test-data.json` for complete configuration.