<?php

declare(strict_types=1);

/**
 * Card Payment Processing Script
 *
 * This script demonstrates card payment processing using the Global Payments SDK.
 * It handles tokenized card data and billing information to process payments
 * securely through the Global Payments API.
 *
 * PHP version 7.4 or higher
 *
 * @category  Payment_Processing
 * @package   GlobalPayments_Sample
 * @author    Global Payments
 * @license   MIT License
 * @link      https://github.com/globalpayments
 */

require_once 'vendor/autoload.php';

ini_set('display_errors', '0');

use Dotenv\Dotenv;
use GlobalPayments\Api\Entities\Address;
use GlobalPayments\Api\Entities\Transaction;
use GlobalPayments\Api\Entities\Enums\Channel;
use GlobalPayments\Api\Entities\Enums\Environment;
use GlobalPayments\Api\Entities\Exceptions\ApiException;
use GlobalPayments\Api\PaymentMethods\CreditCardData;
use GlobalPayments\Api\ServiceConfigs\Gateways\GpApiConfig;
use GlobalPayments\Api\ServicesContainer;

ini_set('display_errors', '0');

/**
 * Configure the SDK
 *
 * Sets up the Global Payments SDK with necessary credentials and settings
 * loaded from environment variables.
 *
 * @return void
 */
function configureSdk(): void
{
    $dotenv = Dotenv::createImmutable(__DIR__);
    $dotenv->load();

    $config = new GpApiConfig();
    $config->appId = $_ENV['APP_ID'];
    $config->appKey = $_ENV['APP_KEY'];
    $config->channel = Channel::CardNotPresent;
    $config->environment = Environment::TEST;
    $config->country = 'IE';
    
    ServicesContainer::configureService($config);
}

/**
 * Sanitize postal code by removing invalid characters
 *
 * @param string|null $postalCode The postal code to sanitize
 *
 * @return string Sanitized postal code containing only alphanumeric
 *                characters and hyphens, limited to 10 characters
 */
function sanitizePostalCode(?string $postalCode): string
{
    if ($postalCode === null) {
        return '';
    }
    
    $sanitized = preg_replace('/[^a-zA-Z0-9-]/', '', $postalCode);
    return substr($sanitized, 0, 10);
}

// Initialize SDK configuration
configureSdk();

try {
    $results = [];

    // Validate required fields
    if (!isset($_POST['payment_token'], $_POST['billing_zip'], $_POST['amount'])) {
        throw new ApiException('Missing required fields');
    }
    
    // Parse and validate amount
    $amount = floatval($_POST['amount']);
    if ($amount <= 0) {
        throw new ApiException('Invalid amount');
    }

    // Initialize payment data using tokenized card information
    $card = new CreditCardData();
    $card->token = $_POST['payment_token'];

    // Create billing address for AVS verification
    $address = new Address();
    $address->postalCode = sanitizePostalCode($_POST['billing_zip']);

    // Process the payment transaction with specified amount
    $response = $card->authorize($amount)
        ->withAllowDuplicates(true)
        ->withCurrency('EUR')
        ->withAddress($address)
        ->execute();
    
    // Verify transaction was successful
    if ($response->responseCode !== 'SUCCESS') {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Payment processing failed',
            'error' => [
                'code' => 'PAYMENT_DECLINED',
                'details' => $response->responseMessage
            ]
        ]);
        exit;
    }

    // Return success response with transaction ID
    $results[] = [
        'success' => true,
        'message' => 'Payment successful! Transaction ID: ' . $response->transactionId,
        'data' => [
            'transactionId' => $response->transactionId
        ]
    ];

    // At a later time (e.g. at shipment), Process the capture transaction with by referencing
    // the previous transaction
    $captureResponse = Transaction::fromId($response->transactionId)
        ->capture()
        ->execute();
    
    // Verify transaction was successful
    if ($captureResponse->responseCode !== 'SUCCESS') {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Payment capture failed',
            'error' => [
                'code' => 'PAYMENT_DECLINED',
                'details' => $captureResponse->responseMessage
            ]
        ]);
        exit;
    }

    // Return success response with transaction ID
    $results[] = [
        'success' => true,
        'message' => 'Capture successful! Transaction ID: ' . $captureResponse->transactionId,
        'data' => [
            'transactionId' => $captureResponse->transactionId
        ]
    ];

    echo json_encode($results);
} catch (ApiException $e) {
    // Handle payment processing errors
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Payment processing failed',
        'error' => [
            'code' => 'API_ERROR',
            'details' => $e->getMessage()
        ]
    ]);
}
