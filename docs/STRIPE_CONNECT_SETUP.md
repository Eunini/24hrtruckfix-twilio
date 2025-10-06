# Stripe Connect Integration Setup Guide

## Overview

This guide walks you through setting up Stripe Connect for your 24-hour service marketplace. Stripe Connect allows your platform to accept payments and automatically distribute funds to service providers (mechanics).

## Features Implemented

- **Stripe Connect Express Accounts**: Easy onboarding for mechanics
- **Payment Processing**: Secure payment handling with automatic fee collection
- **Webhook Handling**: Real-time payment status updates
- **Refund Processing**: Full and partial refund capabilities
- **Revenue Analytics**: Track platform revenue and mechanic earnings
- **Dashboard Access**: Mechanics can access their Stripe dashboard

## Prerequisites

1. A Stripe account (sign up at [stripe.com](https://stripe.com))
2. Node.js application with Express.js
3. MongoDB database
4. SSL certificate for production (required for webhooks)

## Setup Instructions

### 1. Stripe Account Configuration

1. **Create a Stripe Account**

   - Go to [stripe.com](https://stripe.com) and create an account
   - Complete your account verification

2. **Enable Connect**

   - In your Stripe dashboard, go to "Connect" in the left sidebar
   - Click "Get started" and follow the setup process
   - Choose "Express" as your account type

3. **Get API Keys**

   - Go to "Developers" → "API keys"
   - Copy your Publishable Key and Secret Key
   - For testing, use the test keys (starting with `pk_test_` and `sk_test_`)

4. **Create Webhook Endpoint**
   - Go to "Developers" → "Webhooks"
   - Click "Add endpoint"
   - Set URL to: `https://your-domain.com/api/v1/payments/webhooks/stripe`
   - Select events to listen for:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `account.updated`
     - `charge.dispute.created`
   - Copy the webhook signing secret (starts with `whsec_`)

### 2. Environment Variables

Add these environment variables to your `.env` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Application URLs
CLIENT_URL=http://localhost:3000  # Your frontend URL
```

### 3. Database Migration

The integration automatically creates the necessary database models:

- Payment model for transaction records
- Enhanced Mechanic model with Stripe Connect fields
- User model with Stripe customer ID

No manual migration is required as the models use the `getOrCreateModel` utility.

## API Endpoints

### Organization Onboarding

#### 1. Create Stripe Connect Account

```http
POST /api/v1/payments/connect/accounts/:organizationId
```

Creates a Stripe Connect Express account for an organization.

**Response:**

```json
{
  "success": true,
  "message": "Stripe Connect account created successfully",
  "data": {
    "account_id": "acct_1234567890",
    "onboarding_required": true
  }
}
```

#### 2. Create Onboarding Link

```http
POST /api/v1/payments/connect/accounts/:organizationId/onboarding-link
```

**Request Body:**

```json
{
  "refreshUrl": "https://your-app.com/organization/stripe/refresh",
  "returnUrl": "https://your-app.com/organization/stripe/success"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "url": "https://connect.stripe.com/setup/e/acct_...",
    "expires_at": 1234567890
  }
}
```

#### 3. Check Account Status

```http
GET /api/v1/payments/connect/accounts/:organizationId/status
```

**Response:**

```json
{
  "success": true,
  "data": {
    "account_id": "acct_1234567890",
    "status": "active",
    "can_accept_payments": true,
    "charges_enabled": true,
    "payouts_enabled": true,
    "requirements": {}
  }
}
```

### Payment Processing

#### 1. Create Payment Intent

```http
POST /api/v1/payments/intents
```

**Request Body:**

```json
{
  "ticketId": "64a1b2c3d4e5f6789012345",
  "customerId": "64a1b2c3d4e5f6789012346",
  "amount": 150.0,
  "description": "Roadside assistance service"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "payment_intent_id": "pi_1234567890",
    "client_secret": "pi_1234567890_secret_abc123",
    "payment_id": "64a1b2c3d4e5f6789012347",
    "amount": 150.0,
    "application_fee_amount": 4.35,
    "mechanic_amount": 145.65
  }
}
```

#### 2. Process Refund

```http
POST /api/v1/payments/:paymentId/refund
```

**Request Body:**

```json
{
  "amount": 75.0,
  "reason": "requested_by_customer",
  "description": "Service was cancelled"
}
```

### Analytics

#### Revenue Statistics

```http
GET /api/v1/payments/analytics/revenue?organizationId=123&dateFrom=2024-01-01&dateTo=2024-01-31
```

**Response:**

```json
{
  "success": true,
  "data": {
    "total_revenue": 5000.0,
    "total_application_fees": 145.0,
    "total_mechanic_earnings": 4855.0,
    "payment_count": 50,
    "average_payment": 100.0
  }
}
```

## Frontend Integration

### 1. Install Stripe JavaScript SDK

```bash
npm install @stripe/stripe-js
```

### 2. Initialize Stripe

```javascript
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe("pk_test_your_publishable_key");
```

### 3. Process Payment

```javascript
const handlePayment = async (paymentData) => {
  try {
    // Create payment intent
    const response = await fetch("/api/v1/payments/intents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paymentData),
    });

    const { data } = await response.json();
    const stripe = await stripePromise;

    // Confirm payment
    const result = await stripe.confirmCardPayment(data.client_secret, {
      payment_method: {
        card: cardElement,
        billing_details: {
          name: customerName,
          email: customerEmail,
        },
      },
    });

    if (result.error) {
      console.error("Payment failed:", result.error);
    } else {
      console.log("Payment succeeded:", result.paymentIntent);
    }
  } catch (error) {
    console.error("Error processing payment:", error);
  }
};
```

### 4. Organization Onboarding Flow

```javascript
const handleOrganizationOnboarding = async (organizationId) => {
  try {
    // Create Connect account
    await fetch(`/api/v1/payments/connect/accounts/${organizationId}`, {
      method: "POST",
    });

    // Get onboarding link
    const response = await fetch(
      `/api/v1/payments/connect/accounts/${organizationId}/onboarding-link`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          refreshUrl: window.location.href,
          returnUrl: `${window.location.origin}/organization/onboarding/success`,
        }),
      }
    );

    const { data } = await response.json();

    // Redirect to Stripe onboarding
    window.location.href = data.url;
  } catch (error) {
    console.error("Error during onboarding:", error);
  }
};
```

## Testing

### 1. Test Card Numbers

Use these test card numbers for testing:

- **Successful payment**: `4242424242424242`
- **Declined payment**: `4000000000000002`
- **Requires authentication**: `4000002500003155`

### 2. Test Webhooks Locally

Install Stripe CLI:

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows/Linux - download from https://github.com/stripe/stripe-cli/releases
```

Forward webhooks to your local server:

```bash
stripe listen --forward-to localhost:3000/api/v1/payments/webhooks/stripe
```

Trigger test events:

```bash
stripe trigger payment_intent.succeeded
```

## Production Deployment

### 1. Switch to Live Keys

- Replace test keys with live keys in production environment
- Update webhook endpoint URL to production domain

### 2. SSL Certificate

Stripe requires HTTPS for webhook endpoints. Ensure your production server has a valid SSL certificate.

### 3. Webhook Security

The webhook handler verifies the Stripe signature to ensure requests are from Stripe. This is automatically handled by the `StripeService.handleWebhook()` method.

### 4. Error Monitoring

Implement proper error monitoring and logging for payment-related operations:

```javascript
// Example: Log payment failures
console.error("Payment processing error:", {
  paymentId: payment._id,
  error: error.message,
  timestamp: new Date().toISOString(),
});
```

## Common Issues and Solutions

### 1. Webhook Signature Verification Failed

- Ensure the webhook secret matches the one from your Stripe dashboard
- Check that the raw request body is being passed to the webhook handler

### 2. Account Cannot Accept Payments

- Verify the mechanic has completed Stripe onboarding
- Check account status using the status endpoint
- Review any requirements that need to be fulfilled

### 3. Payment Intent Creation Failed

- Ensure the mechanic has a valid Stripe Connect account
- Verify all required fields are provided
- Check that amounts are positive numbers

## Support and Resources

- [Stripe Connect Documentation](https://stripe.com/docs/connect)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe Dashboard](https://dashboard.stripe.com/)
- [Stripe Support](https://support.stripe.com/)

## Security Considerations

1. **Never expose secret keys**: Keep Stripe secret keys secure and never commit them to version control
2. **Validate webhook signatures**: Always verify webhook signatures to prevent malicious requests
3. **Use HTTPS**: All payment-related endpoints must use HTTPS in production
4. **Implement rate limiting**: Protect your payment endpoints from abuse
5. **Log payment events**: Maintain audit trails for all payment-related activities

## License

This integration is part of the 24-hour service marketplace application. Please refer to the main project license for usage terms.
