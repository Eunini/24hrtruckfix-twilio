const path = require("path");
const transporter = require("./emailTransporter");

/**
 * Sends a SAS Flex Message style email with structured data table.
 *
 * @param {Object} params
 * @param {string} params.to              — recipient email address
 * @param {string} params.subject         — email subject line
 * @param {string} params.title           — main title (e.g., "New SAS Flex Message")
 * @param {Object} params.tableData       — object with key-value pairs for the main table
 * @param {Object} params.systemDetails   — object with system details information
 * @param {string} [params.callToAction]  — optional call-to-action button config
 */
const sendSASFlexEmail = async ({ to,  bccList = [], subject, title, tableData, systemDetails, callToAction }) => {
  
  // Helper function to generate table rows
  const generateTableRows = (data) => {
    return Object.entries(data)
      .filter(([key, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => `
        <tr>
          <td style="padding:8px 12px;border:1px solid #ddd;background-color:#f8f9fa;font-weight:bold;text-align:right;width:30%;vertical-align:top;">
            ${key}
          </td>
          <td style="padding:8px 12px;border:1px solid #ddd;background-color:#ffffff;vertical-align:top;">
            ${value}
          </td>
        </tr>
      `).join('');
  };

  // Helper function to generate system details
  const generateSystemDetails = (details) => {
    return Object.entries(details)
      .filter(([key, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => `
        <div style="margin-bottom:5px;">
          <strong style="color:#333;">${key}:</strong> ${value}
        </div>
      `).join('');
  };

  const mailOptions = {
    from: process.env.FROM_EMAIL,
    to,
    bcc: bccList,
    subject,
    html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>${subject}</title>
      <style>
        /* General Reset */
        body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
        table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
        img { -ms-interpolation-mode:bicubic; border:0; height:auto; line-height:100%; outline:none; text-decoration:none; }
        table { border-collapse:collapse!important; }
        body { height:100%!important; margin:0!important; padding:0!important; width:100%!important; background-color:#f4f4f4; font-family:Arial,sans-serif; }

        /* Main Styles */
        .main { background-color:#ffffff; margin:0 auto; width:100%; max-width:600px; border-spacing:0; color:#4a4a4a; }
        .content { padding:20px 30px; }
        .data-table { width:100%; border-collapse:collapse; margin:20px 0; font-size:14px; }
        .data-table td { padding:8px 12px; border:1px solid #ddd; vertical-align:top; }
        .data-table .label { background-color:#f8f9fa; font-weight:bold; text-align:right; width:30%; }
        .data-table .value { background-color:#ffffff; }
        .system-details { background-color:#f8f9fa; padding:15px; margin:20px 0; border-radius:5px; border-left:4px solid #007bff; }
        .button-primary { background-color:#007bff; color:#ffffff; padding:12px 25px; text-decoration:none; border-radius:5px; display:inline-block; font-weight:bold; font-size:16px; }
        .footer-links a { color:#777777; text-decoration:underline; }

        /* Responsive Styles */
        @media screen and (max-width:600px) {
          .content { padding:15px!important; }
          .main { width:100%!important; }
          .logo { width:280px!important; height:auto!important; }
          .data-table .label { width:40%!important; text-align:left!important; }
          .data-table td { padding:6px 8px!important; font-size:13px!important; }
        }
      </style>
    </head>
    <body>
      <center style="width:100%;background-color:#f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td align="center">
              <table class="main" width="600" cellpadding="0" cellspacing="0" role="presentation">
                <!-- HEADER -->
                <tr>
                  <td align="center" style="background-color:#ffffff;padding:20px;">
                    <a href="https://24hrtruckfix.com" target="_blank">
                      <img
                        src="cid:logo"
                        alt="Company Logo"
                        width="300"
                        class="logo"
                        style="display:block;border:0;max-width:100%;height:auto;"
                      >
                    </a>
                  </td>
                </tr>

                <!-- BODY -->
                <tr>
                  <td class="content" style="padding:30px 40px;">
                    <!-- Title -->
                    <h2 style="margin:0 0 20px 0;font-size:24px;font-weight:bold;color:#333333;border-bottom:2px solid #007bff;padding-bottom:10px;">
                      ${title}
                    </h2>

                    <!-- Data Table -->
                    <table class="data-table" width="100%" cellpadding="0" cellspacing="0">
                      ${generateTableRows(tableData)}
                    </table>

                    <!-- System Details -->
                    ${systemDetails && Object.keys(systemDetails).length > 0 ? `
                    <div class="system-details">
                      <h3 style="margin:0 0 15px 0;font-size:18px;color:#333;font-weight:bold;">System Details</h3>
                      <div style="font-size:14px;line-height:1.5;color:#555;">
                        ${generateSystemDetails(systemDetails)}
                      </div>
                    </div>
                    ` : ''}

                    <!-- Call to Action Button -->
                    ${callToAction ? `
                    <div style="text-align:center;margin:30px 0;">
                      <a
                        href="${callToAction.url}"
                        target="_blank"
                        class="button-primary"
                        style="font-family:Arial,sans-serif;color:#ffffff;text-decoration:none;"
                      >
                        ${callToAction.text}
                      </a>
                    </div>
                    ` : ''}

                    <p style="font-size:14px;line-height:1.5;color:#555555;margin:20px 0 0 0;text-align:center;">
                      If you have any questions, please contact our support team.<br>
                      Best regards,<br>
                      The 24 Hour Truck Services Team
                    </p>
                  </td>
                </tr>

                <!-- FOOTER -->
                <tr>
                  <td style="background-color:#eeeeee;padding:30px;text-align:center;font-size:12px;color:#777777;line-height:1.5;">
                    24 Hour Truck Services<br>
                    300 Delaware Ave, Suite 210 #382, Wilmington DE 19801<br><br>
                    <a href="https://example.com/unsubscribe" target="_blank">Unsubscribe</a> |
                    <a href="mailto:support@24hrtruckfix.com" target="_blank">Support</a>
                    <br><br>
                    &copy; ${new Date().getFullYear()} 24 Hour Truck Services. All rights reserved.
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </center>
    </body>
    </html>
    `,
    attachments: [
      {
        filename: "logo.png",
        path: path.join(__dirname, "../../assets/logo.png"),
        cid: "logo",
      },
    ],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ SAS Flex email sent successfully:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Error sending SAS Flex email:", error);
    throw error;
  }
};

module.exports = { sendSASFlexEmail };
