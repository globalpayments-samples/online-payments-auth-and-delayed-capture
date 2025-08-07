#!/bin/bash

# setup-env.sh - Simple environment setup script

set -e

echo "Setting up test environment..."

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cat > .env << EOF
# API Keys for Global Payments
# Replace these sample values with your actual API keys
APP_ID=UJqPrAhrDkGzzNoFInpzKqoI8vfZtGRV
APP_KEY=zCFrbrn0NKly9sB4
EOF
    echo "⚠️  Please update .env with your actual API keys"
fi

# Copy .env to all implementation directories
echo "Copying .env to implementation directories..."
for dir in nodejs php python java go dotnet; do
    if [ -d "$dir" ]; then
        cp .env "$dir/.env"
        echo "✓ Copied .env to $dir/"
    fi
done

# Install test dependencies
echo "Installing test dependencies..."
npm ci

# Install Playwright browsers
echo "Installing Playwright browsers..."
npx playwright install chromium

echo "✅ Environment setup complete!"
echo ""
echo "To run tests:"
echo "  npm test                    # Run all tests"
echo "  npm run test:nodejs         # Test Node.js only"
echo "  npm run test:php            # Test PHP only"
echo "  npm run test:python         # Test Python only"
echo "  npm run test:java           # Test Java only"
echo "  npm run test:go             # Test Go only"
echo "  npm run test:dotnet         # Test .NET only"
echo ""
echo "Don't forget to update your .env file with real API keys!"