# Global Payments Authorization and Delayed Capture

> Authorize a card and capture funds in a separate SDK call via the Global Payments GP API, demonstrated in PHP, Node.js, Java, and .NET.

## Critical Patterns

1. **Use `authorize()` then `Transaction.fromId(id).capture()` — not `charge()`.** All four implementations call `card.authorize(amount)` to reserve funds, then issue a second `capture()` referenced against the auth transaction ID. Calling `charge()` would settle in a single step and defeat the whole point of this sample. The two-step flow lets you delay capture until shipment, fulfillment, or another business event.

2. **Capture happens immediately in the demo, but the pattern supports any delay.** Both calls are made back-to-back inside `POST /process-payment` for demo simplicity. In production, persist the auth `transactionId`, then call `Transaction.fromId(authId).capture().execute()` at the moment you actually want to settle (e.g. order shipment). The auth must be captured before it expires — typical auth holds last ~7 days for card-not-present but vary by issuer.

3. **The capture call passes no amount, so it captures the full authorized amount.** None of the four implementations pass a value to `.capture()`. To capture a partial amount, the SDK supports `.capture(amount)` where `amount` must be ≤ the original auth. Partial captures release the remainder of the auth back to the cardholder's available balance.

4. **Country is hardcoded to `"IE"` and currency to `"EUR"` across all four languages.** This reflects the GP API merchant registration country, not the customer's country. Changing one without updating the merchant config will cause authentication failures from the GP API.

5. **The `/config` endpoint mints a single-use access token with the `PMT_POST_Create_Single` permission only.** The token is scoped to one tokenization request from the browser via `globalpayments.js`. The backend's broader credentials never reach the client. If you add new client-side capabilities (e.g. multi-use tokens, hosted fields refreshes), you must extend the permissions array in each language's `/config` handler.

## Repository Structure

### PHP (native PHP server + Global Payments SDK)
- [`php/process-payment.php`](php/process-payment.php) — `configureSdk()` (L46–59); top-level script handles auth via `card->authorize()` (L105) and capture via `Transaction::fromId()->capture()` (L136); `sanitizePostalCode()` (L69–77)
- [`php/config.php`](php/config.php) — issues access token via `GpApiService::generateTransactionKey()` for browser-side tokenization
- [`php/index.html`](php/index.html) — per-language copy of the payment form
- [`php/composer.json`](php/composer.json) — `globalpayments/php-sdk` ^13.1

### Node.js (Express + Global Payments SDK)
- [`nodejs/server.js`](nodejs/server.js) — `sanitizePostalCode()` (L49–51); `GET /config` handler (L57–82) returns access token; `POST /process-payment` handler (L88–170) runs auth then capture
- [`nodejs/index.html`](nodejs/index.html) — per-language copy of the payment form
- [`nodejs/package.json`](nodejs/package.json) — `globalpayments-api` ^3.10.6

### Java (Jakarta EE servlet + Global Payments SDK)
- [`java/src/main/java/com/globalpayments/example/ProcessPaymentServlet.java`](java/src/main/java/com/globalpayments/example/ProcessPaymentServlet.java) — `init()` (L52–67) configures the SDK; `doGet()` (L79–106) returns access token at `/config`; `doPost()` (L134–223) runs auth then capture; `sanitizePostalCode()` (L116–122)
- [`java/src/main/webapp/index.html`](java/src/main/webapp/index.html) — per-language copy of the payment form
- [`java/pom.xml`](java/pom.xml) — `globalpayments-sdk` 14.2.20, Jakarta Servlet 5.0

### .NET (ASP.NET Core minimal API + Global Payments SDK)
- [`dotnet/Program.cs`](dotnet/Program.cs) — `ConfigureGlobalPaymentsSDK()` (L48–60); `ConfigureEndpoints()` (L67–101) maps `GET /config`; `ConfigurePaymentEndpoint()` (L126–252) handles `POST /process-payment`; `SanitizePostalCode()` (L111–120)
- [`dotnet/wwwroot/index.html`](dotnet/wwwroot/index.html) — per-language copy of the payment form
- [`dotnet/dotnet.csproj`](dotnet/dotnet.csproj) — `GlobalPayments.Api` 9.0.16, net9.0

### Shared
- [`index.html`](index.html) — root copy of the frontend (each language also has its own under `php/`, `nodejs/`, `java/src/main/webapp/`, `dotnet/wwwroot/`)
- [`docker-compose.yml`](docker-compose.yml) — runs all four implementations together on host ports 8001 (Node.js), 8003 (PHP), 8004 (Java), 8006 (.NET)
- [`tests/`](tests/) — Playwright E2E tests run against the Docker stack

## API Surface

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/config` | Returns a short-lived GP API access token scoped to `PMT_POST_Create_Single` for browser tokenization |
| POST | `/process-payment` | Accepts `payment_token`, `billing_zip`, `amount`; runs authorize then capture; returns both transaction IDs |

PHP serves these as physical files: `/config.php` and `/process-payment.php` (no router). Node.js, Java, and .NET expose the bare paths above. The Docker healthcheck for PHP probes `/config.php`; the others probe `/config`.

## Environment Variables

```bash
APP_ID=your_gp_api_app_id    # GP API application ID (used as appId in GpApiConfig)
APP_KEY=your_gp_api_app_key  # GP API application key (used as appKey in GpApiConfig)
PORT=8000                    # Optional; Node.js, PHP, and .NET honor it. Java port is fixed in pom.xml (cargo.servlet.port=8000)
```

Each language directory contains a `.env.sample` — copy to `.env` in the same directory and fill in your credentials. The four samples are identical.

## Test Cards

Use these in the hosted tokenization fields rendered by `globalpayments.js`.

| Brand | Number | CVV | Expiry |
|-------|--------|-----|--------|
| Visa | 4263970000005262 | 123 | Any future date |
| Mastercard | 5425230000004415 | 123 | Any future date |

Get your own sandbox credentials at [developer.globalpayments.com](https://developer.globalpayments.com).

## Architecture Summary

**Tokenization:** browser loads `globalpayments.js` → frontend calls `/config` → server mints scoped access token → client tokenizes card → returns `payment_token`

**Auth + capture:** `POST /process-payment` with `payment_token` → `card.authorize(amount)` reserves funds → server reads `transactionId` from response → `Transaction.fromId(transactionId).capture()` settles funds → server returns both transaction IDs as a 2-element array

## Security Notes

These demos have no authentication on `/config` or `/process-payment`, no rate limiting, no CSRF protection, and log errors with raw exception messages. For production: add request authentication, rate-limit the tokenization endpoint, persist auth transaction IDs in durable storage (not just an HTTP response), and replace `display_errors = 0` / raw exception message echoing with structured logging.

## How to Run

```bash
cd php && ./run.sh       # PHP — :8000 (built-in server)
cd nodejs && ./run.sh    # Node.js — :8000
cd java && ./run.sh      # Java — :8000 (Cargo/Tomcat, port set in pom.xml)
cd dotnet && ./run.sh    # .NET — :8000 (or PORT env)
# All at once (host-port mapped):
docker-compose up        # nodejs:8001, php:8003, java:8004, dotnet:8006
```

Card tokenization runs in the browser via `globalpayments.js`, so the full flow cannot be exercised with curl alone — the `payment_token` field in `POST /process-payment` is produced by the hosted fields running in a real browser. Use `tests/` (Playwright) or load `index.html` in a browser to drive a complete payment.

## How to Verify

```bash
# Config endpoint (returns a short-lived access token)
curl http://localhost:8000/config
# Expected: {"success":true,"data":{"accessToken":"<token>"}}
# (PHP only: curl http://localhost:8000/config.php)

# Process payment (requires a real payment_token from globalpayments.js — see note above)
curl -X POST http://localhost:8000/process-payment \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "payment_token=<token-from-browser>&billing_zip=12345&amount=10.00"
# Expected: [
#   {"success":true,"message":"Payment successful! Transaction ID: ...","data":{"transactionId":"..."}},
#   {"success":true,"message":"Capture successful! Transaction ID: ...","data":{"transactionId":"..."}}
# ]
```

`POST /process-payment` cannot be tested with curl alone because `payment_token` must come from `globalpayments.js` running in a browser against the access token from `/config`. To exercise the full flow programmatically, run the Playwright suite via `npm test` or `docker-compose --profile testing up tests`.

## Making Changes

All language implementations expose identical behavior. A change to one must be applied to all four — each language in a separate commit. Do not modify shared files (`index.html` at the root, `docker-compose.yml`, the per-language `index.html` copies under `php/`, `nodejs/`, `java/src/main/webapp/`, `dotnet/wwwroot/`) without confirming the change applies to every implementation. The `.env.sample` files across the four language dirs must stay in sync.

## SDK Versions

- **PHP**: `globalpayments/php-sdk` ^13.1
- **Node.js**: `globalpayments-api` ^3.10.6
- **Java**: `globalpayments-sdk` 14.2.20
- **.NET**: `GlobalPayments.Api` 9.0.16
