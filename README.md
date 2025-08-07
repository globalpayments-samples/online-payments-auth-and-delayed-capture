# Authorization and Delayed Capture Examples

This directory contains examples of authorization and delayed capture payment integration using the Global Payments SDK across multiple programming languages and frameworks. Each implementation demonstrates the same core functionality while following language-specific best practices.

## Available Implementations

- [.NET Core](./dotnet/) - ASP.NET Core web application
- [Java](./java/) - Jakarta EE servlet-based web application
- [Node.js](./nodejs/) - Express.js web application
- [PHP](./php/) - PHP web application

## Common Features

- Authorization and delayed capture payment processing with tokenization
- Environment-based configuration using .env files
- Error handling and response formatting
- Public/private API key management
- Simple web interface for payment submission

## Core Functionality

All implementations demonstrate:

1. SDK Configuration
   - Loading environment variables
   - Configuring the Global Payments SDK with credentials
   - Setting up service URLs and developer information

2. Authorization Processing
   - Accepting tokenized card data
   - Processing a $10 USD authorization
   - Handling billing address (postal code)
   - Error handling and response formatting

3. API Endpoints
   - GET `/config` - Provides public API key for client-side use
   - POST `/process-payment` - Processes the authorization with token and billing zip
   - Serves a basic HTML interface for testing

## Docker Setup

### Quick Start with Docker

The fastest way to get all implementations running is using Docker:

```bash
# 1. Setup environment
cp .env.sample .env
# Edit .env with your actual API keys

# 2. Make the management script executable
chmod +x docker-run.sh

# 3. Build all containers
./docker-run.sh build

# 4. Start all services
./docker-run.sh start

# 5. Run tests against all implementations
./docker-run.sh test
```

## Traditional Setup (Non-Docker)

If you prefer to run implementations individually without Docker:

### Prerequisites

- Global Payments account
- API credentials (public and private keys)
- Development environment for chosen implementation
- Package manager for dependency installation

### Individual Setup

Each implementation includes:
- Environment variable template (.env.sample)
- Basic run script (run.sh)
- Test page for authorization and capture submission

See individual implementation directories for specific setup instructions.

## Testing

### End-to-End Tests

The project includes comprehensive E2E tests that verify:

1. **Complete Authorization Flow**
   - Page loads successfully
   - Form fields can be filled out
   - Authorization submission works
   - Success/failure responses display correctly

2. **Error Handling**
   - Invalid zip code handling
   - Payment form validation

### Running Tests

```bash
npm test                    # Run all tests
npm run test:chrome         # Test in Chromium only
npm run install:browsers    # Install Playwright browsers
```

### CI Integration

GitHub Actions workflow is configured to:
- Run tests on push to main branch
- Run tests on pull requests
- Generate and upload test reports
- Notify on test failures

## Environment Configuration

All implementations require API credentials in a `.env` file:

```bash
# Copy the sample file
cp .env.sample .env

# Edit with your actual credentials
PUBLIC_API_KEY=pkapi_your_public_key_here
SECRET_API_KEY=skapi_your_secret_key_here
```

## Security Notes

These examples demonstrate basic implementation patterns and should be enhanced for production use with:
- Additional input validation
- Comprehensive error handling
- Proper logging
- Security headers
- Rate limiting
- Additional payment fraud prevention measures

## Production Considerations

This setup is designed for development and testing. For production deployment:

1. **Use multi-stage builds** for smaller Docker images
2. **Implement proper secrets management**
3. **Add monitoring and logging**
4. **Configure resource limits**
5. **Use production-grade base images**
6. **Implement health checks and restart policies**
7. **Use HTTPS in production**
8. **Implement CSRF protection**
9. **Configure secure session handling**

## Contributing

When adding new implementations:

1. Create implementation in new directory
2. Follow existing patterns for structure
3. Create `Dockerfile` for containerization
4. Add service to `docker-compose.yml`
5. Update test configuration
6. Add build and test commands to `docker-run.sh`
7. Update documentation
