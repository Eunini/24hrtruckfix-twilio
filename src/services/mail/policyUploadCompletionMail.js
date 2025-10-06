const transporter = require('./emailTransporter');
const path = require("path");

/**
 * Send policy upload completion notification email
 * @param {string} to - Recipient email address
 * @param {Object} uploadResult - Upload result data
 * @param {Object} organizationInfo - Organization information
 * @param {Object} userInfo - User information
 */
const sendPolicyUploadCompletionEmail = async (to, uploadResult, organizationInfo, userInfo) => {
  const {
    mode,
    summary,
    organizationId,
    processedAt,
    jobId,
    failed = []
  } = uploadResult;

  const isSuccess = summary.failed === 0;
  const statusColor = isSuccess ? '#10B981' : summary.successful > 0 ? '#F59E0B' : '#EF4444';
  const statusText = isSuccess ? 'Completed Successfully' : summary.successful > 0 ? 'Completed with Issues' : 'Failed';
  const statusIcon = isSuccess ? '✅' : summary.successful > 0 ? '⚠️' : '❌';

  const processingTime = new Date(processedAt).toLocaleString();
  const modeText = mode === 'upsert' ? 'Upsert Mode (Replace All)' : 'Individual Validation Mode';

  // Generate failed policies table if there are failures
  let failedPoliciesTable = '';
  if (failed.length > 0) {
    const failedToShow = failed.slice(0, 10); // Show first 10 failures
    failedPoliciesTable = `
      <tr>
        <td style="padding: 20px;">
          <h4 style="font-family: 'Inter', sans-serif; font-weight: 600; font-size: 16px; color: #EF4444; margin: 0 0 15px 0;">
            Failed Policies (${failed.length > 10 ? 'First 10 of ' + failed.length : failed.length}):
          </h4>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #E5E7EB;">
            <thead>
              <tr style="background-color: #F9FAFB;">
                <th style="padding: 8px; border: 1px solid #E5E7EB; font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; text-align: left;">Policy Number</th>
                <th style="padding: 8px; border: 1px solid #E5E7EB; font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 600; text-align: left;">Error</th>
              </tr>
            </thead>
            <tbody>
              ${failedToShow.map(failure => `
                <tr>
                  <td style="padding: 8px; border: 1px solid #E5E7EB; font-family: 'Inter', sans-serif; font-size: 12px;">${failure.policy_number}</td>
                  <td style="padding: 8px; border: 1px solid #E5E7EB; font-family: 'Inter', sans-serif; font-size: 12px; color: #EF4444;">${failure.error}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${failed.length > 10 ? `<p style="font-family: 'Inter', sans-serif; font-size: 12px; color: #6B7280; margin: 10px 0 0 0;">... and ${failed.length - 10} more failures</p>` : ''}
        </td>
      </tr>
    `;
  }

  const mailOptions = {
    from: process.env.FROM_EMAIL || "notifications@24hrtruckfix.com",
    to: to,
    subject: `Policy Upload ${statusText} - ${organizationInfo.companyName || 'Organization'}`,
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
            
            <!-- Status Header -->
            <tr>
              <td style="text-align: center; padding: 20px; background-color: ${statusColor};">
                <h2 style="font-family: 'Inter', sans-serif; font-weight: 700; font-size: 24px; color: white; margin: 0;">
                  ${statusIcon} Policy Upload ${statusText}
                </h2>
              </td>
            </tr>
            
            <!-- Greeting -->
            <tr>
              <td style="padding: 20px;">
                <h3 style="font-family: 'Inter', sans-serif; font-weight: 600; font-size: 18px; color: #1F2937; margin: 0 0 10px 0;">
                  Hello ${userInfo.firstname || userInfo.name || 'User'},
                </h3>
                <p style="font-family: 'Inter', sans-serif; font-weight: 400; font-size: 16px; color: #374151; margin: 0;">
                  Your policy bulk upload has been processed. Here are the details:
                </p>
              </td>
            </tr>
            
            <!-- Upload Summary -->
            <tr>
              <td style="padding: 0 20px 20px 20px;">
                <div style="background-color: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px;">
                  <h4 style="font-family: 'Inter', sans-serif; font-weight: 600; font-size: 16px; color: #1F2937; margin: 0 0 15px 0;">
                    Upload Summary
                  </h4>
                  
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; color: #6B7280; width: 40%;">Organization:</td>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; color: #1F2937;">${organizationInfo.companyName || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; color: #6B7280;">Processing Mode:</td>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; color: #1F2937;">${modeText}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; color: #6B7280;">Job ID:</td>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; color: #1F2937; font-family: monospace;">${jobId || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; color: #6B7280;">Processed At:</td>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; color: #1F2937;">${processingTime}</td>
                    </tr>
                  </table>
                </div>
              </td>
            </tr>
            
            <!-- Results -->
            <tr>
              <td style="padding: 0 20px 20px 20px;">
                <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 20px;">
                  <h4 style="font-family: 'Inter', sans-serif; font-weight: 600; font-size: 16px; color: #1F2937; margin: 0 0 15px 0;">
                    Processing Results
                  </h4>
                  
                  <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                    <div style="text-align: center; flex: 1;">
                      <div style="font-family: 'Inter', sans-serif; font-size: 24px; font-weight: 700; color: #1F2937;">${summary.total}</div>
                      <div style="font-family: 'Inter', sans-serif; font-size: 12px; color: #6B7280;">Total Policies</div>
                    </div>
                    <div style="text-align: center; flex: 1;">
                      <div style="font-family: 'Inter', sans-serif; font-size: 24px; font-weight: 700; color: #10B981;">${summary.successful}</div>
                      <div style="font-family: 'Inter', sans-serif; font-size: 12px; color: #6B7280;">Successful</div>
                    </div>
                    <div style="text-align: center; flex: 1;">
                      <div style="font-family: 'Inter', sans-serif; font-size: 24px; font-weight: 700; color: #EF4444;">${summary.failed}</div>
                      <div style="font-family: 'Inter', sans-serif; font-size: 12px; color: #6B7280;">Failed</div>
                    </div>
                    <div style="text-align: center; flex: 1;">
                      <div style="font-family: 'Inter', sans-serif; font-size: 24px; font-weight: 700; color: #1461eb;">${summary.successRate}</div>
                      <div style="font-family: 'Inter', sans-serif; font-size: 12px; color: #6B7280;">Success Rate</div>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
            
            ${failedPoliciesTable}
            
            <!-- Action Items -->
            <tr>
              <td style="padding: 0 20px 20px 20px;">
                <div style="background-color: #FEF3C7; border: 1px solid #FCD34D; border-radius: 8px; padding: 15px;">
                  <h4 style="font-family: 'Inter', sans-serif; font-weight: 600; font-size: 14px; color: #92400E; margin: 0 0 10px 0;">
                    📋 Next Steps:
                  </h4>
                  <ul style="font-family: 'Inter', sans-serif; font-size: 14px; color: #92400E; margin: 0; padding-left: 20px;">
                    ${isSuccess ? 
                      '<li>All policies have been successfully uploaded and are now active in the system.</li>' :
                      summary.successful > 0 ?
                        '<li>Review the failed policies listed above and correct any data issues.</li><li>Re-upload the corrected policies if needed.</li><li>Contact support if you need assistance with the errors.</li>' :
                        '<li>All policies failed to upload. Please review the error messages above.</li><li>Correct the data issues and try uploading again.</li><li>Contact support if you continue to experience issues.</li>'
                    }
                    <li>You can view and manage your policies in the dashboard.</li>
                    <li>Contact support if you have any questions about this upload.</li>
                  </ul>
                </div>
              </td>
            </tr>
            
            <!-- Support -->
            <tr>
              <td style="padding: 0 20px 20px 20px;">
                <p style="font-family: 'Inter', sans-serif; font-weight: 400; font-size: 14px; color: #6B7280; margin: 0; text-align: center;">
                  If you have any questions or need assistance, please contact us at
                  <a href="mailto:Service@24hrtruckfix.com" style="color: #1461eb; font-weight: 600; text-decoration: underline;">Service@24hrtruckfix.com</a>
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
        path: path.join(__dirname, "../../assets/logo.png"), // Adjusted path
        cid: "logo@24hrs",
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📧 Policy upload completion email sent successfully to ${to}`);
    return { success: true, message: 'Email sent successfully' };
  } catch (error) {
    console.error("❌ Error sending policy upload completion email:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Send policy upload started notification email
 * @param {string} to - Recipient email address
 * @param {Object} jobInfo - Job information
 * @param {Object} organizationInfo - Organization information
 * @param {Object} userInfo - User information
 */
const sendPolicyUploadStartedEmail = async (to, jobInfo, organizationInfo, userInfo) => {
  const { jobId, totalRecords, estimatedProcessingTime, mode } = jobInfo;
  const modeText = mode === 'upsert' ? 'Upsert Mode (Replace All)' : 'Individual Validation Mode';

  const mailOptions = {
    from: process.env.FROM_EMAIL || "notifications@24hrtruckfix.com",
    to: to,
    subject: `Policy Upload Started - ${organizationInfo.companyName || 'Organization'}`,
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
            
            <!-- Status Header -->
            <tr>
              <td style="text-align: center; padding: 20px; background-color: #3B82F6;">
                <h2 style="font-family: 'Inter', sans-serif; font-weight: 700; font-size: 24px; color: white; margin: 0;">
                  🚀 Policy Upload Started
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
                  Your policy bulk upload has been queued and is now being processed. Here are the details:
                </p>
                
                <div style="background-color: #F0F9FF; border: 1px solid #BAE6FD; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; color: #6B7280; width: 40%;">Organization:</td>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; color: #1F2937;">${organizationInfo.companyName || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; color: #6B7280;">Processing Mode:</td>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; color: #1F2937;">${modeText}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; color: #6B7280;">Job ID:</td>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; color: #1F2937; font-family: monospace;">${jobId}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; color: #6B7280;">Total Policies:</td>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; color: #1F2937; font-weight: 600;">${totalRecords}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 500; color: #6B7280;">Estimated Time:</td>
                      <td style="padding: 8px 0; font-family: 'Inter', sans-serif; font-size: 14px; color: #1F2937;">${estimatedProcessingTime}</td>
                    </tr>
                  </table>
                </div>
                
                <p style="font-family: 'Inter', sans-serif; font-weight: 400; font-size: 14px; color: #6B7280; margin: 0;">
                  You will receive another email notification once the processing is complete with detailed results.
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
    console.log(`📧 Policy upload started email sent successfully to ${to}`);
    return { success: true, message: 'Email sent successfully' };
  } catch (error) {
    console.error("❌ Error sending policy upload started email:", error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendPolicyUploadCompletionEmail,
  sendPolicyUploadStartedEmail,
}; 