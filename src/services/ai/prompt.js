/**
 * Get a prompt for a given function, channel, and outcome.
 * @param {string} fnKey      – e.g. 'ticketCreated'
 * @param {string} channel    – 'sys' | 'sms' | 'email'
 * @param {string} outcome    – 'success' | 'error'
 * @param {Object} params     – template variables
 */
function getPrompt(fnKey, channel, outcome, params = {}) {
    const fn = prompts[fnKey];
    if (!fn || !fn[channel] || !fn[channel][outcome]) {
      throw new Error(`Prompt not found: ${fnKey}.${channel}.${outcome}`);
    }
    return fn[channel][outcome](params);
  }
  
  const prompts = {
    ticketCreated: {
      sys: {
        success: ({ ticketId }) =>
          `Ticket #${ticketId} received; assigning mechanic to driver.`,
        error: ({ error }) => `Ticket creation failed: ${error}`,
      },
      sms: {
        success: ({ ticketId }) =>
          `A new ticket #${ticketId} has been received. Assigning a mechanic now.`,
        error: ({ error }) => `Ticket creation error: ${error}`,
      },
      email: {
        success: ({ ticketId }) => ({
          subject: `Ticket #${ticketId} Created`,
          body: `Ticket #${ticketId} has been created and is now in auto-assignment.\n\nCheck the dashboard for details.`,
        }),
        error: ({ error }) => ({
          subject: `Ticket Creation Failed`,
          body: `Failed to create new ticket: ${error}\n\nPlease investigate the error logs.`,
        }),
      },
    },
  
    locationSmsSent: {
      sys: {
        success: ({ ticketId }) => `Location link sent for ticket #${ticketId}.`,
        error: ({ error }) => `Location SMS failed: ${error}`,
      },
      sms: {
        success: ({ ticketId }) => `Sent location link for ticket #${ticketId}.`,
        error: ({ error }) => `Location link send error: ${error}`,
      },
      email: {
        success: ({ ticketId }) => ({
          subject: `Location Link Sent for #${ticketId}`,
          body: `We have sent the location link to the driver for ticket #${ticketId}.`,
        }),
        error: ({ error }) => ({
          subject: `Location Link Failed for Ticket`,
          body: `Error sending location link: ${error}`,
        }),
      },
    },
  
    locationAscertained: {
      sys: {
        success: ({ ticketId }) =>
          `Driver location ascertained for #${ticketId}.`,
        error: ({ error }) => `Location ascertain failed: ${error}`,
      },
      sms: {
        success: ({ ticketId }) =>
          `Driver location confirmed for ticket #${ticketId}. Dispatching mechanic.`,
        error: ({ error }) => `Location confirm error: ${error}`,
      },
      email: {
        success: ({ ticketId }) => ({
          subject: `Location Confirmed for #${ticketId}`,
          body: `Driver location has been confirmed for ticket #${ticketId}. Proceeding with dispatch.`,
        }),
        error: ({ error }) => ({
          subject: `Location Confirmation Failed`,
          body: `Error confirming driver location: ${error}`,
        }),
      },
    },
  
    spCallStarted: {
      sys: {
        success: ({ ticketId }) =>
          `Service provider calls started for #${ticketId}.`,
        error: ({ error }) => `SP call error: ${error}`,
      },
      sms: {
        success: ({ ticketId }) =>
          `Contacting service providers for ticket #${ticketId}.`,
        error: ({ error }) => `SP contact error: ${error}`,
      },
      email: {
        success: ({ ticketId }) => ({
          subject: `Dispatch Underway for #${ticketId}`,
          body: `We have begun contacting service providers for ticket #${ticketId}.`,
        }),
        error: ({ error }) => ({
          subject: `Dispatch Failure for Ticket`,
          body: `Error dispatching service providers: ${error}`,
        }),
      },
    },
  
    // userRegistered: {
    //   sys: {
    //     success: ({ userId, email }) =>
    //       `New user registered: ${email} (ID: ${userId}).`,
    //     error: ({ error }) => `User registration failed: ${error}`,
    //   },
    //   sms: {
    //     success: ({ email }) =>
    //       `Welcome to 24HR Truck Services! Your account (${email}) is ready. Log in to start.`,
    //     error: ({ error }) => `Registration error: ${error}`,
    //   },
    //   email: {
    //     success: ({ email, userId }) => ({
    //       subject: `Welcome to 24HR Truck Services!`,
    //       body: `Hello,\n\nThank you for joining 24HR Truck Services! Your account (${email}) has been successfully created (User ID: ${userId}).\n\nLog in to your dashboard to start managing your services.\n\nBest regards,\n24HR Truck Services Team`,
    //     }),
    //     error: ({ error }) => ({
    //       subject: `Registration Error`,
    //       body: `We encountered an issue while creating your account: ${error}\n\nPlease contact support or try again.`,
    //     }),
    //   },
    // },
  };
  
  module.exports = { getPrompt };