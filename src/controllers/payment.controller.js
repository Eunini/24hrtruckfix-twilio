const StripeService = require("../services/stripe.service");
const { Payment, Mechanic, User, Organization, Ticket } = require("../models");
const { validationResult } = require("express-validator");
const crypto = require("crypto");

class PaymentController {
  constructor() {
    this.stripeService = new StripeService();

    // Bind all methods to preserve 'this' context
    this.getStripeOAuthURL = this.getStripeOAuthURL.bind(this);
    this.handleStripeCallback = this.handleStripeCallback.bind(this);
    this.createConnectAccount = this.createConnectAccount.bind(this);
    this.createOnboardingLink = this.createOnboardingLink.bind(this);
    this.getAccountStatus = this.getAccountStatus.bind(this);
    this.createLoginLink = this.createLoginLink.bind(this);
    this.createPaymentIntent = this.createPaymentIntent.bind(this);
    this.getPayment = this.getPayment.bind(this);
    this.listMechanicPayments = this.listMechanicPayments.bind(this);
    this.processRefund = this.processRefund.bind(this);
    this.handleWebhook = this.handleWebhook.bind(this);
    this.handlePaymentSuccess = this.handlePaymentSuccess.bind(this);
    this.handlePaymentFailed = this.handlePaymentFailed.bind(this);
    this.handleAccountUpdated = this.handleAccountUpdated.bind(this);
    this.handleChargeDispute = this.handleChargeDispute.bind(this);
    this.getRevenueStats = this.getRevenueStats.bind(this);
  }

  /**
   * Generate Stripe OAuth URL for organization
   */
  async getStripeOAuthURL(req, res) {
    try {
      const { organizationId } = req.params;
      const organization = await Organization.findById(organizationId);

      if (!organization) {
        return res.status(404).json({
          success: false,
          message: "Organization not found",
        });
      }

      // Generate a secure random state
      const state = crypto.randomUUID();

      // Update organization with the new state
      await Organization.findByIdAndUpdate(organizationId, {
        "stripe_connect.oauth_state": state,
        updatedAt: new Date(),
      });

      // Construct the OAuth URL
      const connectURL = new URL("https://connect.stripe.com/oauth/authorize");
      connectURL.searchParams.set("response_type", "code");
      connectURL.searchParams.set("client_id", process.env.STRIPE_CLIENT_ID);
      connectURL.searchParams.set("scope", "read_write");
      connectURL.searchParams.set("state", state);
      connectURL.searchParams.set(
        "redirect_uri",
        `${process.env.SERVER_URL}/api/v1/payments/connect/callback`
      );

      res.json({
        success: true,
        data: {
          url: connectURL.toString(),
        },
      });
    } catch (error) {
      console.error("Error generating Stripe OAuth URL:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate OAuth URL",
        error: error.message,
      });
    }
  }

  /**
   * Handle Stripe OAuth callback
   */
  async handleStripeCallback(req, res) {
    const { code, state, error } = req.query;

    console.log(req.query);

    try {
      // Verify the state parameter
      if (!state) {
        return res.redirect(
          `${process.env.NEXT_PUBLIC_BASE_URL}/profile?error=invalid_state`
        );
      }

      // Find organization with matching state
      const organization = await Organization.findOne({
        "stripe_connect.oauth_state": state,
      });

      console.log(organization);

      if (!organization) {
        return res.redirect(
          `${process.env.NEXT_PUBLIC_BASE_URL}/profile?error=invalid_state`
        );
      }

      // Handle Stripe error response
      if (error) {
        // Clear the state token
        await Organization.findByIdAndUpdate(organization._id, {
          "stripe_connect.oauth_state": null,
          updatedAt: new Date(),
        });

        return res.redirect(
          `${process.env.NEXT_PUBLIC_BASE_URL}/profile?error=${error}`
        );
      }

      if (!code) {
        throw new Error("No code provided");
      }

      // Exchange authorization code for access token
      const response = await this.stripeService.exchangeOAuthCode(code);
      const connectedAccountId = response.stripe_user_id;

      // Update organization with Stripe account ID and clear the state
      await Organization.findByIdAndUpdate(organization._id, {
        "stripe_connect.account_id": connectedAccountId,
        "stripe_connect.oauth_state": null,
        "stripe_connect.created_at": new Date(),
        updatedAt: new Date(),
      });

      // Verify the connected account
      const account = await this.stripeService.getAccount(connectedAccountId);
      if (!account) {
        throw new Error("Failed to verify Stripe account");
      }

      // Update organization with account details
      await organization.updateStripeConnect({
        account_id: account.id,
        account_type: account.type,
        country: account.country,
        default_currency: account.default_currency,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        onboarding_completed:
          account.details_submitted && account.charges_enabled,
        requirements: {
          currently_due: account.requirements?.currently_due || [],
          eventually_due: account.requirements?.eventually_due || [],
          past_due: account.requirements?.past_due || [],
          pending_verification:
            account.requirements?.pending_verification || [],
          disabled_reason: account.requirements?.disabled_reason,
        },
      });

      return res.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/profile?success=true`
      );
    } catch (error) {
      console.error("Stripe Connect Error:", error);

      // Clear the state token even on error
      if (state) {
        await Organization.findOneAndUpdate(
          { "stripe_connect.oauth_state": state },
          {
            "stripe_connect.oauth_state": null,
            updatedAt: new Date(),
          }
        );
      }

      return res.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/profile?error=connection_failed`
      );
    }
  }

  /**
   * Create Stripe Connect account for organization
   */
  async createConnectAccount(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { organizationId } = req.params;
      const organization = await Organization.findById(organizationId).populate(
        "owner"
      );

      if (!organization) {
        return res.status(404).json({
          success: false,
          message: "Organization not found",
        });
      }

      // Check if organization already has a Stripe account
      if (organization.stripe_connect?.account_id) {
        return res.status(400).json({
          success: false,
          message: "Organization already has a Stripe Connect account",
          account_id: organization.stripe_connect.account_id,
        });
      }

      // Create Stripe Connect account using organization and owner details
      const ownerUser = organization.owner;
      const account = await this.stripeService.createConnectAccount({
        email: organization.keyBillingContactEmail || ownerUser.email,
        firstName:
          organization.keyBillingContactName?.split(" ")[0] ||
          ownerUser.firstname,
        lastName:
          organization.keyBillingContactName?.split(" ").slice(1).join(" ") ||
          ownerUser.lastname,
        phone: organization.keyBillingContactPhone || ownerUser.phoneNumber,
        businessName: organization.companyName,
        businessType: organization.businessEntityType,
        organizationType: organization.organization_type,
      });

      // Update organization with Stripe account information
      await organization.updateStripeConnect({
        account_id: account.id,
        account_type: account.type,
        country: account.country,
        default_currency: account.default_currency,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        created_at: new Date(),
      });

      res.status(201).json({
        success: true,
        message: "Stripe Connect account created successfully",
        data: {
          account_id: account.id,
          onboarding_required: !account.details_submitted,
        },
      });
    } catch (error) {
      console.error("Error creating Stripe Connect account:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create Stripe Connect account",
        error: error.message,
      });
    }
  }

  /**
   * Create onboarding link for organization
   */
  async createOnboardingLink(req, res) {
    try {
      const { organizationId } = req.params;
      const { refreshUrl, returnUrl } = req.body;

      const organization = await Organization.findById(organizationId);
      if (!organization) {
        return res.status(404).json({
          success: false,
          message: "Organization not found",
        });
      }

      if (!organization.stripe_connect?.account_id) {
        return res.status(400).json({
          success: false,
          message: "Organization does not have a Stripe Connect account",
        });
      }

      const accountLink = await this.stripeService.createAccountLink(
        organization.stripe_connect.account_id,
        refreshUrl ||
          `${process.env.NEXT_PUBLIC_BASE_URL}/organization/stripe/refresh`,
        returnUrl ||
          `${process.env.NEXT_PUBLIC_BASE_URL}/organization/stripe/success`
      );

      // Update organization with onboarding link
      await organization.updateStripeConnect({
        onboarding_link: {
          url: accountLink.url,
          expires_at: new Date(accountLink.expires_at * 1000),
        },
      });

      res.json({
        success: true,
        message: "Onboarding link created successfully",
        data: {
          url: accountLink.url,
          expires_at: accountLink.expires_at,
        },
      });
    } catch (error) {
      console.error("Error creating onboarding link:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create onboarding link",
        error: error.message,
      });
    }
  }

  /**
   * Get Stripe Connect account status
   */
  async getAccountStatus(req, res) {
    try {
      const { organizationId } = req.params;
      const organization = await Organization.findById(organizationId);

      if (!organization) {
        return res.status(404).json({
          success: false,
          message: "Organization not found",
        });
      }

      if (!organization.stripe_connect?.account_id) {
        return res.json({
          success: true,
          data: {
            status: "not_created",
            can_accept_payments: false,
          },
        });
      }

      // Get latest account information from Stripe
      const account = await this.stripeService.getAccount(
        organization.stripe_connect.account_id
      );

      // Update organization with latest information
      await organization.updateStripeConnect({
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        onboarding_completed:
          account.details_submitted && account.charges_enabled,
        requirements: {
          currently_due: account.requirements?.currently_due || [],
          eventually_due: account.requirements?.eventually_due || [],
          past_due: account.requirements?.past_due || [],
          pending_verification:
            account.requirements?.pending_verification || [],
          disabled_reason: account.requirements?.disabled_reason,
        },
      });

      res.json({
        success: true,
        data: {
          account_id: account.id,
          status: organization.stripe_connect_status,
          can_accept_payments: organization.canAcceptPayments(),
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          details_submitted: account.details_submitted,
          requirements: account.requirements,
        },
      });
    } catch (error) {
      console.error("Error getting account status:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get account status",
        error: error.message,
      });
    }
  }

  /**
   * Create dashboard login link for organization
   */
  async createLoginLink(req, res) {
    try {
      const { organizationId } = req.params;
      const organization = await Organization.findById(organizationId);

      if (!organization) {
        return res.status(404).json({
          success: false,
          message: "Organization not found",
        });
      }

      if (!organization.stripe_connect?.account_id) {
        return res.status(400).json({
          success: false,
          message: "Organization does not have a Stripe Connect account",
        });
      }

      const loginLink = await this.stripeService.createLoginLink(
        organization.stripe_connect.account_id
      );

      res.json({
        success: true,
        message: "Login link created successfully",
        data: {
          url: loginLink.url,
        },
      });
    } catch (error) {
      console.error("Error creating login link:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create login link",
        error: error.message,
      });
    }
  }

  /**
   * Create payment intent for a service
   */
  async createPaymentIntent(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { ticketId, customerId, amount, description } = req.body;

      // Get ticket and validate
      const ticket = await Ticket.findById(ticketId).populate("mechanic_id");
      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: "Ticket not found",
        });
      }

      // Get customer
      const customer = await User.findById(customerId);
      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Customer not found",
        });
      }

      // Get mechanic for service tracking
      const mechanic = await Mechanic.findById(ticket.mechanic_id);
      if (!mechanic) {
        return res.status(404).json({
          success: false,
          message: "Mechanic not found",
        });
      }

      // Get organization for payment processing
      const organization = await Organization.findById(
        mechanic.organization_id
      );
      if (!organization) {
        return res.status(404).json({
          success: false,
          message: "Organization not found",
        });
      }

      // Validate organization has Stripe Connect account
      if (!organization?.canAcceptPayments()) {
        return res.status(400).json({
          success: false,
          message:
            "Organization cannot accept payments. Please complete Stripe onboarding.",
        });
      }

      // Calculate application fee (platform commission)
      const applicationFeeAmount =
        this.stripeService.calculateApplicationFee(amount);
      const mechanicAmount = amount - applicationFeeAmount;

      // Create or get Stripe customer
      let stripeCustomerId = customer.stripe_customer_id;
      if (!stripeCustomerId) {
        const stripeCustomer = await this.stripeService.createCustomer({
          email: customer.email,
          firstName: customer.firstname,
          lastName: customer.lastname,
          phone: customer.phoneNumber,
          userId: customer._id,
          organizationId: customer.organization,
        });
        stripeCustomerId = stripeCustomer.id;

        // Update user with Stripe customer ID
        await User.findByIdAndUpdate(customerId, {
          stripe_customer_id: stripeCustomerId,
        });
      }

      // Create payment intent using organization's Stripe account
      const paymentIntent = await this.stripeService.createPaymentIntent({
        amount,
        mechanicAccountId: organization.stripe_connect.account_id,
        applicationFeeAmount,
        description:
          description ||
          `Service: ${ticket.service_type} - ${ticket.breakdown_reason}`,
        metadata: {
          ticket_id: ticketId,
          customer_id: customerId,
          mechanic_id: mechanic._id.toString(),
          organization_id: organization._id.toString(),
        },
      });

      // Create payment record
      const payment = new Payment({
        ticket_id: ticketId,
        customer_id: customerId,
        mechanic_id: mechanic._id,
        organization_id: organization._id,
        stripe_payment_intent_id: paymentIntent.id,
        stripe_customer_id: stripeCustomerId,
        stripe_connected_account_id: organization.stripe_connect.account_id,
        amount,
        application_fee_amount: applicationFeeAmount,
        mechanic_amount: mechanicAmount,
        service_type: ticket.service_type,
        service_description: description || ticket.breakdown_reason,
        status: paymentIntent.status,
        metadata: paymentIntent.metadata,
      });

      await payment.save();

      res.status(201).json({
        success: true,
        message: "Payment intent created successfully",
        data: {
          payment_intent_id: paymentIntent.id,
          client_secret: paymentIntent.client_secret,
          payment_id: payment._id,
          amount,
          application_fee_amount: applicationFeeAmount,
          mechanic_amount: mechanicAmount,
        },
      });
    } catch (error) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create payment intent",
        error: error.message,
      });
    }
  }

  /**
   * Get payment details
   */
  async getPayment(req, res) {
    try {
      const { paymentId } = req.params;
      const payment = await Payment.findById(paymentId)
        .populate("customer_id", "firstname lastname email phoneNumber")
        .populate("mechanic_id", "firstName lastName email mobileNumber")
        .populate("organization_id", "companyName")
        .populate("ticket_id", "service_type breakdown_reason");

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: "Payment not found",
        });
      }

      res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      console.error("Error getting payment:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get payment",
        error: error.message,
      });
    }
  }

  /**
   * List payments for a mechanic
   */
  async listMechanicPayments(req, res) {
    try {
      const { mechanicId } = req.params;
      const { page = 1, limit = 10, status, dateFrom, dateTo } = req.query;

      const options = {
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        dateFrom: dateFrom ? new Date(dateFrom) : null,
        dateTo: dateTo ? new Date(dateTo) : null,
      };

      const payments = await Payment.findByMechanic(mechanicId, options);

      res.json({
        success: true,
        data: payments,
      });
    } catch (error) {
      console.error("Error listing mechanic payments:", error);
      res.status(500).json({
        success: false,
        message: "Failed to list payments",
        error: error.message,
      });
    }
  }

  /**
   * Process refund
   */
  async processRefund(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: errors.array(),
        });
      }

      const { paymentId } = req.params;
      const { amount, reason, description } = req.body;

      const payment = await Payment.findById(paymentId);
      if (!payment) {
        return res.status(404).json({
          success: false,
          message: "Payment not found",
        });
      }

      if (payment.status !== "succeeded") {
        return res.status(400).json({
          success: false,
          message: "Can only refund successful payments",
        });
      }

      // Process refund through Stripe
      const refund = await this.stripeService.processRefund(
        payment.stripe_payment_intent_id,
        amount,
        { reason, metadata: { description } }
      );

      // Add refund to payment record
      await payment.addRefund({
        stripe_refund_id: refund.id,
        amount: refund.amount / 100, // Convert from cents
        reason: refund.reason,
        description,
        status: refund.status,
        refunded_at: refund.status === "succeeded" ? new Date() : null,
      });

      res.json({
        success: true,
        message: "Refund processed successfully",
        data: {
          refund_id: refund.id,
          amount: refund.amount / 100,
          status: refund.status,
        },
      });
    } catch (error) {
      console.error("Error processing refund:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process refund",
        error: error.message,
      });
    }
  }

  /**
   * Handle Stripe webhooks
   */
  async handleWebhook(req, res) {
    try {
      const signature = req.headers["stripe-signature"];
      const payload = req.body;

      // Construct and verify webhook event
      const event = await this.stripeService.handleWebhook(payload, signature);

      console.log(`Received Stripe webhook: ${event.type}`);

      // Handle different event types
      switch (event.type) {
        case "payment_intent.succeeded":
          await this.handlePaymentSuccess(event.data.object);
          break;

        case "payment_intent.payment_failed":
          await this.handlePaymentFailed(event.data.object);
          break;

        case "account.updated":
          await this.handleAccountUpdated(event.data.object);
          break;

        case "charge.dispute.created":
          await this.handleChargeDispute(event.data.object);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Error handling webhook:", error);
      res.status(400).json({
        success: false,
        message: "Webhook handling failed",
        error: error.message,
      });
    }
  }

  /**
   * Handle successful payment
   */
  async handlePaymentSuccess(paymentIntent) {
    try {
      const payment = await Payment.findOne({
        stripe_payment_intent_id: paymentIntent.id,
      });

      if (payment) {
        await payment.updateStatus("succeeded", {
          payment_date: new Date(),
        });

        await payment.addWebhookEvent(
          paymentIntent.id,
          "payment_intent.succeeded"
        );

        console.log(`Payment ${payment._id} marked as succeeded`);
      }
    } catch (error) {
      console.error("Error handling payment success:", error);
    }
  }

  /**
   * Handle failed payment
   */
  async handlePaymentFailed(paymentIntent) {
    try {
      const payment = await Payment.findOne({
        stripe_payment_intent_id: paymentIntent.id,
      });

      if (payment) {
        await payment.updateStatus("failed", {
          error: paymentIntent.last_payment_error?.message,
          error_code: paymentIntent.last_payment_error?.code,
        });

        await payment.addWebhookEvent(
          paymentIntent.id,
          "payment_intent.payment_failed"
        );

        console.log(`Payment ${payment._id} marked as failed`);
      }
    } catch (error) {
      console.error("Error handling payment failure:", error);
    }
  }

  /**
   * Handle account updates
   */
  async handleAccountUpdated(account) {
    try {
      const organization = await Organization.findOne({
        "stripe_connect.account_id": account.id,
      });

      if (organization) {
        await organization.updateStripeConnect({
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          details_submitted: account.details_submitted,
          onboarding_completed:
            account.details_submitted && account.charges_enabled,
          requirements: {
            currently_due: account.requirements?.currently_due || [],
            eventually_due: account.requirements?.eventually_due || [],
            past_due: account.requirements?.past_due || [],
            pending_verification:
              account.requirements?.pending_verification || [],
            disabled_reason: account.requirements?.disabled_reason,
          },
        });

        console.log(`Organization ${organization._id} Stripe account updated`);
      }
    } catch (error) {
      console.error("Error handling account update:", error);
    }
  }

  /**
   * Handle charge disputes
   */
  async handleChargeDispute(dispute) {
    try {
      const payment = await Payment.findOne({
        stripe_payment_intent_id: dispute.payment_intent,
      });

      if (payment) {
        await payment.addNote(
          `Dispute created: ${dispute.reason} - ${
            dispute.evidence_details?.submission_count || 0
          } evidence submissions`,
          null // System note
        );

        console.log(`Dispute created for payment ${payment._id}`);
      }
    } catch (error) {
      console.error("Error handling charge dispute:", error);
    }
  }

  /**
   * Get revenue statistics
   */
  async getRevenueStats(req, res) {
    try {
      const { organizationId, mechanicId, dateFrom, dateTo } = req.query;

      const filters = {};
      if (organizationId) filters.organization_id = organizationId;
      if (mechanicId) filters.mechanic_id = mechanicId;
      if (dateFrom) filters.dateFrom = new Date(dateFrom);
      if (dateTo) filters.dateTo = new Date(dateTo);

      const stats = await Payment.getRevenueStats(filters);

      res.json({
        success: true,
        data: stats[0] || {
          total_revenue: 0,
          total_application_fees: 0,
          total_mechanic_earnings: 0,
          payment_count: 0,
          average_payment: 0,
        },
      });
    } catch (error) {
      console.error("Error getting revenue stats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get revenue statistics",
        error: error.message,
      });
    }
  }
}

// Change the export to create a new instance
const paymentController = new PaymentController();
module.exports = paymentController;
