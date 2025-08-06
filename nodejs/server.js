/**
 * Global Payments SDK Template - Node.js
 * 
 * This Express application provides a starting template for Global Payments SDK integration.
 * Customize the endpoints and logic below for your specific use case.
 */

import express from 'express';
import * as dotenv from 'dotenv';
import {
    ServicesContainer,
    GpApiConfig,
    Address,
    CreditCardData,
    ApiError,
    Channel,
    Environment,
    Transaction,
    GpApiService
} from 'globalpayments-api';

// Load environment variables from .env file
dotenv.config();

/**
 * Initialize Express application with necessary middleware
 */
const app = express();
const port = process.env.PORT || 8000;

app.use(express.static('.')); // Serve static files
app.use(express.urlencoded({ extended: true })); // Parse form data
app.use(express.json()); // Parse JSON requests

// Configure Global Payments SDK with credentials and settings
const config = new GpApiConfig();
config.appId = process.env.APP_ID;
config.appKey = process.env.APP_KEY;
config.channel = Channel.CardNotPresent;
config.environment = Environment.TEST;
config.country = 'IE';
ServicesContainer.configureService(config);

/**
 * Utility function to sanitize postal code
 * Customize validation logic as needed for your use case
 */
const sanitizePostalCode = (postalCode) => {
    return postalCode.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 10);
};

/**
 * Config endpoint - provides access token for client-side use
 * Customize response data as needed
 */
app.get('/config', async (req, res) => {
    try {
        const clientConfig = new GpApiConfig();;
        clientConfig.appId = config.appId;
        clientConfig.appKey = config.appKey;
        clientConfig.channel = config.channel;
        clientConfig.environment = config.environment;
        clientConfig.country = config.enableLogging;
        clientConfig.permissions = ['PMT_POST_Create_Single'];

        const accessTokenInfo = await GpApiService.generateTransactionKey(clientConfig);
        res.json({
            success: true,
            data: {
                accessToken: accessTokenInfo.accessToken
                // Add other configuration data as needed
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to generate access token',
            error: error.message
        });
    }
});

/**
 * Example payment processing endpoint
 * Customize this endpoint for your specific payment flow
 */
app.post('/process-payment', async (req, res) => {
    try {        
        if (!req.body.payment_token) {
            throw new Error('Payment token is required');
        }

        const card = new CreditCardData();
        card.token = req.body.payment_token;

        // Customize amount and other parameters as needed
        const amount = req.body.amount || 10.00;

        const results = [];

        // Add billing address if needed
        const address = new Address();
        if (req.body.billing_zip) {
            address.postalCode = sanitizePostalCode(req.body.billing_zip);
        }
        
        const response = await card.authorize(amount)
            .withAllowDuplicates(true)
            .withCurrency('EUR')
            .withAddress(address)
            .execute();
            
        // Verify transaction was successful
        if (response.responseCode !== 'SUCCESS') {
            return res.status(400).json({
                success: false,
                message: 'Payment authorization failed',
                error: {
                    code: 'PAYMENT_DECLINED',
                    details: response.responseMessage
                }
            });
        }

        // Add authorization result
        results.push({
            success: true,
            message: 'Payment successful! Transaction ID: ' + response.transactionId,
            data: {
                transactionId: response.transactionId
            }
        });

        // At a later time (e.g. at shipment), Process the capture transaction
        const captureResponse = await Transaction.fromId(response.transactionId)
            .capture()
            .execute();
        
        // Verify capture was successful
        if (captureResponse.responseCode !== 'SUCCESS') {
            return res.status(400).json({
                success: false,
                message: 'Payment capture failed',
                error: {
                    code: 'PAYMENT_DECLINED',
                    details: captureResponse.responseMessage
                }
            });
        }

        // Add capture result
        results.push({
            success: true,
            message: 'Capture successful! Transaction ID: ' + captureResponse.transactionId,
            data: {
                transactionId: captureResponse.transactionId
            }
        });

        res.json(results);

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Payment processing failed',
            error: error.message
        });
    }
});

/**
 * Add your custom endpoints here
 * Examples:
 * - app.post('/authorize', ...) // Authorization only
 * - app.post('/capture', ...)   // Capture authorized payment
 * - app.post('/refund', ...)    // Process refund
 * - app.get('/transaction/:id', ...) // Get transaction details
 */

// Start the server
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Customize this template for your use case!`);
});