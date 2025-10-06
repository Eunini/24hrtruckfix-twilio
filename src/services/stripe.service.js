const Stripe = require("stripe");

class StripeService {
  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error(
        "STRIPE_SECRET_KEY is not defined in environment variables"
      );
    }
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  /**
   * Create a Stripe Connect Express account for a mechanic or organization
   * @param {Object} accountData - Account information
   * @returns {Promise<Object>} Stripe account object
   */
  async createConnectAccount(accountData) {
    try {
      const {
        email,
        firstName,
        lastName,
        phone,
        businessName,
        businessType,
        organizationType,
        specialty,
      } = accountData;

      const accountConfig = {
        type: "express",
        country: "US",
        email: email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      };

      // Configure for business/organization or individual
      if (businessName) {
        accountConfig.business_type = "company";
        accountConfig.company = {
          name: businessName,
          phone: phone,
        };

        // Set business profile for organizations
        accountConfig.business_profile = {
          mcc: organizationType === "fleet" ? "7538" : "8999", // Automotive services or professional services
          product_description: `${
            organizationType || "Service"
          } marketplace services`,
          name: businessName,
        };
      } else {
        accountConfig.business_type = "individual";
        accountConfig.individual = {
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone,
        };

        // Set business profile for individuals (mechanics)
        accountConfig.business_profile = {
          mcc: "7538", // Automotive service shops
          product_description: specialty
            ? specialty.join(", ")
            : "Automotive repair and maintenance services",
        };
      }

      accountConfig.settings = {
        payouts: {
          schedule: {
            interval: "daily",
          },
        },
      };

      const account = await this.stripe.accounts.create(accountConfig);
      return account;
    } catch (error) {
      console.error("Error creating Stripe Connect account:", error);
      throw new Error(`Failed to create Stripe account: ${error.message}`);
    }
  }

  /**
   * Create account link for onboarding
   * @param {string} accountId - Stripe account ID
   * @param {string} refreshUrl - URL to redirect if link expires
   * @param {string} returnUrl - URL to redirect after successful onboarding
   * @returns {Promise<Object>} Account link object
   */
  async createAccountLink(accountId, refreshUrl, returnUrl) {
    try {
      const accountLink = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: "account_onboarding",
      });

      return accountLink;
    } catch (error) {
      console.error("Error creating account link:", error);
      throw new Error(`Failed to create account link: ${error.message}`);
    }
  }

  /**
   * Retrieve account information
   * @param {string} accountId - Stripe account ID
   * @returns {Promise<Object>} Account information
   */
  async getAccount(accountId) {
    try {
      const account = await this.stripe.accounts.retrieve(accountId);
      return account;
    } catch (error) {
      console.error("Error retrieving account:", error);
      throw new Error(`Failed to retrieve account: ${error.message}`);
    }
  }

  /**
   * Check if account can accept payments
   * @param {string} accountId - Stripe account ID
   * @returns {Promise<boolean>} Whether account can accept payments
   */
  async canAcceptPayments(accountId) {
    try {
      const account = await this.getAccount(accountId);
      return account.charges_enabled && account.payouts_enabled;
    } catch (error) {
      console.error("Error checking account status:", error);
      return false;
    }
  }

  /**
   * Create a payment intent for a service
   * @param {Object} paymentData - Payment information
   * @returns {Promise<Object>} Payment intent object
   */
  async createPaymentIntent(paymentData) {
    try {
      const {
        amount,
        currency = "usd",
        mechanicAccountId,
        applicationFeeAmount,
        description,
        metadata = {},
      } = paymentData;

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        application_fee_amount: applicationFeeAmount
          ? Math.round(applicationFeeAmount * 100)
          : undefined,
        transfer_data: {
          destination: mechanicAccountId,
        },
        description,
        metadata: {
          ...metadata,
          service_type: "automotive_repair",
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return paymentIntent;
    } catch (error) {
      console.error("Error creating payment intent:", error);
      throw new Error(`Failed to create payment intent: ${error.message}`);
    }
  }

  /**
   * Create a setup intent for saving payment methods
   * @param {string} customerId - Customer ID
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Setup intent object
   */
  async createSetupIntent(customerId, options = {}) {
    try {
      const setupIntent = await this.stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ["card"],
        usage: "off_session",
        ...options,
      });

      return setupIntent;
    } catch (error) {
      console.error("Error creating setup intent:", error);
      throw new Error(`Failed to create setup intent: ${error.message}`);
    }
  }

  /**
   * Create a customer
   * @param {Object} customerData - Customer information
   * @returns {Promise<Object>} Customer object
   */
  async createCustomer(customerData) {
    try {
      const customer = await this.stripe.customers.create({
        email: customerData.email,
        name: `${customerData.firstName} ${customerData.lastName}`,
        phone: customerData.phone,
        metadata: {
          user_id: customerData.userId,
          organization_id: customerData.organizationId,
        },
      });

      return customer;
    } catch (error) {
      console.error("Error creating customer:", error);
      throw new Error(`Failed to create customer: ${error.message}`);
    }
  }

  /**
   * Process a refund
   * @param {string} paymentIntentId - Payment intent ID
   * @param {number} amount - Refund amount (optional, full refund if not specified)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Refund object
   */
  async processRefund(paymentIntentId, amount = null, options = {}) {
    try {
      const refundData = {
        payment_intent: paymentIntentId,
        ...options,
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100); // Convert to cents
      }

      const refund = await this.stripe.refunds.create(refundData);
      return refund;
    } catch (error) {
      console.error("Error processing refund:", error);
      throw new Error(`Failed to process refund: ${error.message}`);
    }
  }

  /**
   * Get account balance
   * @param {string} accountId - Stripe account ID
   * @returns {Promise<Object>} Balance object
   */
  async getAccountBalance(accountId) {
    try {
      const balance = await this.stripe.balance.retrieve({
        stripeAccount: accountId,
      });
      return balance;
    } catch (error) {
      console.error("Error retrieving balance:", error);
      throw new Error(`Failed to retrieve balance: ${error.message}`);
    }
  }

  /**
   * List transactions for an account
   * @param {string} accountId - Stripe account ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Transactions list
   */
  async listTransactions(accountId, options = {}) {
    try {
      const transactions = await this.stripe.balanceTransactions.list(
        {
          limit: options.limit || 10,
          starting_after: options.starting_after,
          ending_before: options.ending_before,
          ...options,
        },
        {
          stripeAccount: accountId,
        }
      );
      return transactions;
    } catch (error) {
      console.error("Error listing transactions:", error);
      throw new Error(`Failed to list transactions: ${error.message}`);
    }
  }

  /**
   * Create a payout to connected account
   * @param {string} accountId - Stripe account ID
   * @param {number} amount - Payout amount
   * @param {string} currency - Currency (default: usd)
   * @returns {Promise<Object>} Payout object
   */
  async createPayout(accountId, amount, currency = "usd") {
    try {
      const payout = await this.stripe.payouts.create(
        {
          amount: Math.round(amount * 100),
          currency,
        },
        {
          stripeAccount: accountId,
        }
      );
      return payout;
    } catch (error) {
      console.error("Error creating payout:", error);
      throw new Error(`Failed to create payout: ${error.message}`);
    }
  }

  /**
   * Handle webhook events
   * @param {string} payload - Raw webhook payload
   * @param {string} signature - Webhook signature
   * @returns {Promise<Object>} Constructed event
   */
  async handleWebhook(payload, signature) {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      return event;
    } catch (error) {
      console.error("Error handling webhook:", error);
      throw new Error(
        `Webhook signature verification failed: ${error.message}`
      );
    }
  }

  /**
   * Create a login link for Express accounts
   * @param {string} accountId - Stripe account ID
   * @returns {Promise<Object>} Login link object
   */
  async createLoginLink(accountId) {
    try {
      const loginLink = await this.stripe.accounts.createLoginLink(accountId);
      return loginLink;
    } catch (error) {
      console.error("Error creating login link:", error);
      throw new Error(`Failed to create login link: ${error.message}`);
    }
  }

  /**
   * Calculate application fee (platform commission)
   * @param {number} amount - Service amount
   * @param {number} feePercentage - Fee percentage (default: 2.9%)
   * @returns {number} Application fee amount
   */
  calculateApplicationFee(amount, feePercentage = 2.9) {
    return Math.round(((amount * feePercentage) / 100) * 100) / 100;
  }

  /**
   * Exchange OAuth code for access token
   * @param {string} code - Authorization code from Stripe
   * @returns {Promise<Object>} OAuth response
   */
  async exchangeOAuthCode(code) {
    try {
      const response = await this.stripe.oauth.token({
        grant_type: "authorization_code",
        code,
      });
      return response;
    } catch (error) {
      console.error("Error exchanging OAuth code:", error);
      throw new Error(`Failed to exchange OAuth code: ${error.message}`);
    }
  }
}

module.exports = StripeService;
