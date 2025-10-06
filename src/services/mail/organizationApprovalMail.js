const transporter = require('./emailTransporter');
const path = require("path");

/**
 * Send organization approval email with AI setup details
 * @param {string} to - Recipient email address
 * @param {Object} organizationInfo - Organization information
 * @param {Object} userInfo - User information
 * @param {Object} aiSetupInfo - AI setup information
 */
const sendOrganizationApprovalEmail = async (to, organizationInfo, userInfo, aiSetupInfo) => {
  const {
    companyName,
    status,
    approvedAt
  } = organizationInfo;

  const {
    phoneNumber,
    inboundAssistantId,
    outboundAssistantId,
    setupDate
  } = aiSetupInfo;

  const approvalDate = new Date(approvedAt || Date.now()).toLocaleString();
  const aiSetupDate = new Date(setupDate || Date.now()).toLocaleString();

  const mailOptions = {
    from: process.env.FROM_EMAIL || "notifications@24hrtruckfix.com",
    to: to,
    subject: `🎉 Organization Approved - Welcome to 24hrsService AI Platform!`,
    html: `
      <body style="margin: 0; padding: 0; background: #f9fafb;">
        <table style="max-width: 600px; width: 100%; margin: 0 auto; position: relative; padding-top: 30px; top: 20px; box-shadow: 0 0px 22px 0px #bebebe40;" cellspacing="0" cellpadding="0">
          <tbody style="margin: 30px 0px; background: #fff;">
            <!-- Header -->
            <tr>
              <td style="text-align: center; padding: 10px 20px; background-color: #1461eb;">
                <img src="cid:logo@24hrs" alt="24hrs Logo" style="max-width: 120px; width: 100%; height: auto;">
              </td>
            </tr>
            
            <!-- Success Header -->
            <tr>
              <td style="text-align: center; padding: 20px; background-color: #10B981;">
                <h2 style="font-family: 'Inter', sans-serif; font-weight: 700; font-size: 24px; color: white; margin: 0;">
                  🎉 Organization Approved!
                </h2>
              </td>
            </tr>
            
            <!-- Greeting -->
            <tr>
              <td style="padding: 20px;">
                <h3 style="font-family: 'Inter', sans-serif; font-weight: 600; font-size: 18px; color: #1F2937; margin: 0 0 10px 0;">
                  Congratulations ${userInfo.firstname || userInfo.name || 'User'}!
                </h3>
                <p style="font-family: 'Inter', sans-serif; font-weight: 400; font-size: 16px; color: #374151; margin: 0 0 20px 0;">
                  Your organization <strong>${companyName}</strong> has been approved and your AI service has been automatically set up. You're now ready to start using our advanced AI-powered customer service platform!
                </p>
              </td>
            </tr>
            
            <!-- Organization Details -->
            <tr>
              <td style="padding: 0 20px 20px 20px;">
                <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 20px;">
                  <h4 style="font-family: 'Inter', sans-serif; font-weight: 600; font-size: 16px; color: #1F2937; margin: 0 0 15px 0;">
                    📋 Organization Details
                  </h4>
                  
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; color: #6B7280; width: 40%;">Company Name:</td>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; color: #1F2937; font-weight: 600;">${companyName}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; color: #6B7280;">Status:</td>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; color: #10B981; font-weight: 600;">✅ ${status || 'Approved'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; color: #6B7280;">Approved Date:</td>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; color: #1F2937;">${approvalDate}</td>
                    </tr>
                  </table>
                </div>
              </td>
            </tr>
            
            <!-- AI Setup Details -->
            <tr>
              <td style="padding: 0 20px 20px 20px;">
                <div style="background-color: #F0F9FF; border: 1px solid #BAE6FD; border-radius: 8px; padding: 20px;">
                  <h4 style="font-family: 'Inter', sans-serif; font-weight: 600; font-size: 16px; color: #1F2937; margin: 0 0 15px 0;">
                    🤖 AI Service Setup Complete
                  </h4>
                  
                  <p style="font-family: 'Inter', sans-serif; font-size: 14px; color: #374151; margin: 0 0 15px 0;">
                    We've automatically configured your AI service with the following components:
                  </p>
                  
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; color: #6B7280; width: 40%;">Service Phone Number:</td>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; color: #1F2937; font-weight: 600; font-family: monospace;">${phoneNumber}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; color: #6B7280;">Inbound AI Assistant:</td>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; color: #1F2937;">✅ ${companyName} inbound</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; color: #6B7280;">Outbound AI Assistant:</td>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; color: #1F2937;">✅ ${companyName} outbound</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; color: #6B7280;">Setup Date:</td>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; color: #1F2937;">${aiSetupDate}</td>
                    </tr>
                  </table>
                </div>
              </td>
            </tr>
            
            <!-- What's Next -->
            <tr>
              <td style="padding: 0 20px 20px 20px;">
                <div style="background-color: #FEF3C7; border: 1px solid #FCD34D; border-radius: 8px; padding: 20px;">
                  <h4 style="font-family: 'Inter', sans-serif; font-weight: 600; font-size: 16px; color: #92400E; margin: 0 0 15px 0;">
                    🚀 What's Next?
                  </h4>
                  
                  <div style="margin-bottom: 15px;">
                    <h5 style="font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14px; color: #92400E; margin: 0 0 8px 0;">
                      📞 Your AI Phone Service
                    </h5>
                    <ul style="font-family: 'Inter', sans-serif; font-size: 14px; color: #92400E; margin: 0; padding-left: 20px;">
                      <li>Customers can now call <strong>${phoneNumber}</strong> for 24/7 AI assistance</li>
                      <li>Your inbound AI assistant will handle customer inquiries and dispatch requests</li>
                      <li>Your outbound AI assistant will contact mechanics for job assignments</li>
                    </ul>
                  </div>
                  
                  <div style="margin-bottom: 15px;">
                    <h5 style="font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14px; color: #92400E; margin: 0 0 8px 0;">
                      🎛️ Platform Access
                    </h5>
                    <ul style="font-family: 'Inter', sans-serif; font-size: 14px; color: #92400E; margin: 0; padding-left: 20px;">
                      <li>Log in to your dashboard to monitor AI activity and performance</li>
                      <li>Customize AI responses and workflows for your business needs</li>
                      <li>View call logs, transcripts, and analytics</li>
                      <li>Manage your mechanic network and dispatch preferences</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h5 style="font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14px; color: #92400E; margin: 0 0 8px 0;">
                      📚 Getting Started
                    </h5>
                    <ul style="font-family: 'Inter', sans-serif; font-size: 14px; color: #92400E; margin: 0; padding-left: 20px;">
                      <li>Test your AI service by calling your new number</li>
                      <li>Add your mechanics to the platform for dispatch automation</li>
                      <li>Configure your service areas and pricing</li>
                      <li>Set up your business hours and emergency protocols</li>
                    </ul>
                  </div>
                </div>
              </td>
            </tr>
            
            <!-- Technical Details -->
            <tr>
              <td style="padding: 0 20px 20px 20px;">
                <div style="background-color: #F3F4F6; border: 1px solid #D1D5DB; border-radius: 8px; padding: 15px;">
                  <h5 style="font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14px; color: #374151; margin: 0 0 10px 0;">
                    🔧 Technical Information
                  </h5>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 4px 0; font-family: 'Inter', sans-serif; font-size: 12px; color: #6B7280; width: 40%;">Inbound Assistant ID:</td>
                      <td style="padding: 4px 0; font-family: 'Inter', sans-serif; font-size: 12px; color: #374151; font-family: monospace;">${inboundAssistantId}</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; font-family: 'Inter', sans-serif; font-size: 12px; color: #6B7280;">Outbound Assistant ID:</td>
                      <td style="padding: 4px 0; font-family: 'Inter', sans-serif; font-size: 12px; color: #374151; font-family: monospace;">${outboundAssistantId}</td>
                    </tr>
                  </table>
                </div>
              </td>
            </tr>
            
            <!-- Support -->
            <tr>
              <td style="padding: 0 20px 20px 20px;">
                <p style="font-family: 'Inter', sans-serif; font-weight: 400; font-size: 14px; color: #6B7280; margin: 0; text-align: center;">
                  Need help getting started? Contact our support team at
                  <a href="mailto:Service@24hrtruckfix.com" style="color: #1461eb; font-weight: 600; text-decoration: underline;">Service@24hrtruckfix.com</a>
                  or call us at <a href="tel:+1-800-24HR-SVC" style="color: #1461eb; font-weight: 600; text-decoration: underline;">1-800-24HR-SVC</a>
                </p>
              </td>
            </tr>
            
            <!-- Footer -->
            <tr>
              <td style="background: #1461eb; padding: 20px;">
                <p style="font-family: 'Inter', sans-serif; font-weight: 500; font-size: 12px; color: #fff; text-align: center; margin: 0;">
                  Welcome to the future of automotive service! 🚗✨<br>
                  &copy; ${new Date().getFullYear()} 24hrsService, Inc. All Rights Reserved.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    `,
    attachments: [
      {
        filename: "logo.png",
        path: path.join(__dirname, "../../assets/logo.png"),
        cid: "logo@24hrs",
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Organization approval email sent successfully to ${to}`);
    return { success: true, message: 'Email sent successfully' };
  } catch (error) {
    console.error("❌ Error sending organization approval email:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Send organization setup failure notification email
 * @param {string} to - Recipient email address
 * @param {Object} organizationInfo - Organization information
 * @param {Object} userInfo - User information
 * @param {Object} errorInfo - Error information
 */
const sendOrganizationSetupFailureEmail = async (to, organizationInfo, userInfo, errorInfo) => {
  const { companyName } = organizationInfo;
  const { step, error, timestamp } = errorInfo;

  const mailOptions = {
    from: process.env.FROM_EMAIL || "notifications@24hrtruckfix.com",
    to: to,
    subject: `⚠️ Organization Setup Issue - ${companyName}`,
    html: `
      <body style="margin: 0; padding: 0; background: #f9fafb;">
        <table style="max-width: 600px; width: 100%; margin: 0 auto; position: relative; padding-top: 30px; top: 20px; box-shadow: 0 0px 22px 0px #bebebe40;" cellspacing="0" cellpadding="0">
          <tbody style="margin: 30px 0px; background: #fff;">
            <!-- Header -->
            <tr>
              <td style="text-align: center; padding: 10px 20px; background-color: #1461eb;">
                <img src="cid:logo@24hrs" alt="24hrs Logo" style="max-width: 120px; width: 100%; height: auto;">
              </td>
            </tr>
            
            <!-- Warning Header -->
            <tr>
              <td style="text-align: center; padding: 20px; background-color: #F59E0B;">
                <h2 style="font-family: 'Inter', sans-serif; font-weight: 700; font-size: 24px; color: white; margin: 0;">
                  ⚠️ Setup Issue Detected
                </h2>
              </td>
            </tr>
            
            <!-- Content -->
            <tr>
              <td style="padding: 20px;">
                <h3 style="font-family: 'Inter', sans-serif; font-weight: 600; font-size: 18px; color: #1F2937; margin: 0 0 10px 0;">
                  Hello ${userInfo.firstname || userInfo.name || 'User'},
                </h3>
                <p style="font-family: 'Inter', sans-serif; font-weight: 400; font-size: 16px; color: #374151; margin: 0 0 20px 0;">
                  We encountered an issue while setting up the AI service for <strong>${companyName}</strong>. Our technical team has been notified and is working to resolve this issue.
                </p>
                
                <div style="background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                  <h4 style="font-family: 'Inter', sans-serif; font-weight: 600; font-size: 16px; color: #DC2626; margin: 0 0 10px 0;">
                    Error Details
                  </h4>
                  <p style="font-family: 'Inter', sans-serif; font-size: 14px; color: #7F1D1D; margin: 0 0 10px 0;">
                    <strong>Failed Step:</strong> ${step}
                  </p>
                  <p style="font-family: 'Inter', sans-serif; font-size: 14px; color: #7F1D1D; margin: 0 0 10px 0;">
                    <strong>Error:</strong> ${error}
                  </p>
                  <p style="font-family: 'Inter', sans-serif; font-size: 14px; color: #7F1D1D; margin: 0;">
                    <strong>Time:</strong> ${new Date(timestamp).toLocaleString()}
                  </p>
                </div>
                
                <p style="font-family: 'Inter', sans-serif; font-weight: 400; font-size: 14px; color: #6B7280; margin: 0;">
                  We will contact you once the issue is resolved and your AI service is ready.
                </p>
              </td>
            </tr>
            
            <!-- Footer -->
            <tr>
              <td style="background: #1461eb; padding: 20px;">
                <p style="font-family: 'Inter', sans-serif; font-weight: 500; font-size: 12px; color: #fff; text-align: center; margin: 0;">
                  &copy; ${new Date().getFullYear()} 24hrsService, Inc. All Rights Reserved.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    `,
    attachments: [
      {
        filename: "logo.png",
        path: path.join(__dirname, "../../assets/logo.png"),
        cid: "logo@24hrs",
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Organization setup failure email sent successfully to ${to}`);
    return { success: true, message: 'Email sent successfully' };
  } catch (error) {
    console.error("❌ Error sending organization setup failure email:", error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendOrganizationApprovalEmail,
  sendOrganizationSetupFailureEmail,
}; 