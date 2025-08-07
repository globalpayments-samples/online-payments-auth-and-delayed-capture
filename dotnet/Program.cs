using GlobalPayments.Api;
using GlobalPayments.Api.Entities;
using GlobalPayments.Api.PaymentMethods;
using GlobalPayments.Api.Entities.Enums;
using GlobalPayments.Api.Services;
using dotenv.net;

namespace CardPaymentSample;

/// <summary>
/// Authorization and Delayed Capture Processing Application
/// 
/// This application demonstrates authorization and delayed capture payment processing 
/// using the Global Payments SDK. It processes authorization and immediate capture
/// in a single workflow, handling tokenized card data to ensure secure payment processing.
/// </summary>
public class Program
{
    public static void Main(string[] args)
    {
        // Load environment variables from .env file
        DotEnv.Load();

        var builder = WebApplication.CreateBuilder(args);
        
        var app = builder.Build();

        // Configure static file serving for the payment form
        app.UseDefaultFiles();
        app.UseStaticFiles();
        
        // Configure the SDK on startup
        var config = ConfigureGlobalPaymentsSDK();
        ServicesContainer.ConfigureService(config);

        ConfigureEndpoints(app, config);
        
        var port = System.Environment.GetEnvironmentVariable("PORT") ?? "8000";
        app.Urls.Add($"http://0.0.0.0:{port}");
        
        app.Run();
    }

    /// <summary>
    /// Configures the Global Payments SDK with necessary credentials and settings.
    /// This must be called before processing any payments.
    /// </summary>
    private static GpApiConfig ConfigureGlobalPaymentsSDK()
    {
        var config = new GpApiConfig
        {
            AppId = System.Environment.GetEnvironmentVariable("APP_ID"),
            AppKey = System.Environment.GetEnvironmentVariable("APP_KEY"),
            Channel = Channel.CardNotPresent,
            Environment = GlobalPayments.Api.Entities.Environment.TEST,
            Country = "IE",
        };
        
        return config;
    }

    /// <summary>
    /// Configures the application's HTTP endpoints for payment processing.
    /// </summary>
    /// <param name="app">The web application to configure</param>
    /// <param name="config">The GP API configuration</param>
    private static void ConfigureEndpoints(WebApplication app, GpApiConfig config)
    {
        // Configure HTTP endpoints
        app.MapGet("/config", () => {
            try
            {
                var clientConfig = new GpApiConfig();
                clientConfig.AppId = config.AppId;
                clientConfig.AppKey = config.AppKey;
                clientConfig.Channel = config.Channel;
                clientConfig.Environment = config.Environment;
                clientConfig.Country = config.Country;
                clientConfig.Permissions = new string[] { "PMT_POST_Create_Single" };
                var accessTokenInfo = GpApiService.GenerateTransactionKey(clientConfig);
                return Results.Ok(new
                { 
                    success = true,
                    data = new {
                        accessToken = accessTokenInfo.Token
                    }
                });
            }
            catch (Exception ex)
            {
                return Results.Problem(new
                {
                    success = false,
                    message = "Failed to generate access token",
                    error = ex.Message
                }.ToString(), statusCode: 500);
            }
        });

        ConfigurePaymentEndpoint(app);
    }

    /// <summary>
    /// Sanitizes postal code input by removing invalid characters.
    /// </summary>
    /// <param name="postalCode">The postal code to sanitize. Can be null.</param>
    /// <returns>
    /// A sanitized postal code containing only alphanumeric characters and hyphens,
    /// limited to 10 characters. Returns empty string if input is null or empty.
    /// </returns>
    private static string SanitizePostalCode(string postalCode)
    {
        if (string.IsNullOrEmpty(postalCode)) return string.Empty;
        
        // Remove any characters that aren't alphanumeric or hyphen
        var sanitized = new string(postalCode.Where(c => char.IsLetterOrDigit(c) || c == '-').ToArray());
        
        // Limit length to 10 characters
        return sanitized.Length > 10 ? sanitized[..10] : sanitized;
    }

    /// <summary>
    /// Configures the payment processing endpoint that handles authorization and capture transactions.
    /// </summary>
    /// <param name="app">The web application to configure</param>
    private static void ConfigurePaymentEndpoint(WebApplication app)
    {
        app.MapPost("/process-payment", async (HttpContext context) =>
        {
            // Parse form data from the request
            var form = await context.Request.ReadFormAsync();
            var billingZip = form["billing_zip"].ToString();
            var token = form["payment_token"].ToString();
            var amountStr = form["amount"].ToString();

            // Validate required fields are present
            if (string.IsNullOrEmpty(token) || string.IsNullOrEmpty(billingZip) || string.IsNullOrEmpty(amountStr))
            {
                return Results.BadRequest(new {
                    success = false,
                    message = "Payment processing failed",
                    error = new {
                        code = "VALIDATION_ERROR",
                        details = "Missing required fields"
                    }
                });
            }

            // Validate and parse amount
            if (!decimal.TryParse(amountStr, out var amount) || amount <= 0)
            {
                return Results.BadRequest(new {
                    success = false,
                    message = "Payment processing failed",
                    error = new {
                        code = "VALIDATION_ERROR",
                        details = "Amount must be a positive number"
                    }
                });
            }

            // Initialize payment data using tokenized card information
            var card = new CreditCardData
            {
                Token = token
            };

            // Create billing address for AVS verification
            var address = new Address
            {
                PostalCode = SanitizePostalCode(billingZip)
            };

            try
            {
                var results = new List<object>();

                // Process the authorization transaction using the provided amount
                var authResponse = card.Authorize(amount)
                    .WithAllowDuplicates(true)
                    .WithCurrency("EUR")
                    .WithAddress(address)
                    .Execute();

                // Verify authorization was successful
                if (authResponse.ResponseCode != "SUCCESS")
                {
                    return Results.BadRequest(new {
                        success = false,
                        message = "Payment authorization failed",
                        error = new {
                            code = "PAYMENT_DECLINED",
                            details = authResponse.ResponseMessage
                        }
                    });
                }

                // Add authorization result
                results.Add(new
                {
                    success = true,
                    message = $"Payment successful! Transaction ID: {authResponse.TransactionId}",
                    data = new {
                        transactionId = authResponse.TransactionId
                    }
                });

                // At a later time (e.g. at shipment), Process the capture transaction
                var captureResponse = Transaction.FromId(authResponse.TransactionId)
                    .Capture()
                    .Execute();

                // Verify capture was successful
                if (captureResponse.ResponseCode != "SUCCESS")
                {
                    return Results.BadRequest(new {
                        success = false,
                        message = "Payment capture failed",
                        error = new {
                            code = "PAYMENT_DECLINED",
                            details = captureResponse.ResponseMessage
                        }
                    });
                }

                // Add capture result
                results.Add(new
                {
                    success = true,
                    message = $"Capture successful! Transaction ID: {captureResponse.TransactionId}",
                    data = new {
                        transactionId = captureResponse.TransactionId
                    }
                });

                // Return success response with both transaction IDs
                return Results.Ok(results);
            } 
            catch (ApiException ex)
            {
                // Handle payment processing errors
                return Results.BadRequest(new {
                    success = false,
                    message = "Payment processing failed",
                    error = new {
                        code = "API_ERROR",
                        details = ex.Message
                    }
                });
            }
        });
    }
}
