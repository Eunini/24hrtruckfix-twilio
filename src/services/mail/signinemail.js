const path = require("path");
const transporter = require("./emailTransporter");

/**
 * Sends a security alert email when a new sign-in is detected.
 *
 * @param {Object} params
 * @param {string} params.to            — recipient email address
 * @param {string} params.firstName     — recipient’s first name
 * @param {string} params.timeOfLogin   — formatted time of the login event
 * @param {string} params.deviceType    — e.g. “Chrome on Windows”
 * @param {string} params.location      — approximate location, e.g. “New York, USA”
 */
const sendSigninEmail = async (to, firstName, timeOfLogin, deviceType, location) => {
  const mailOptions = {
    from: process.env.FROM_EMAIL,
    to,
    subject: "Security Alert: New Sign-In to Your 24 Hour Truck Services Account",
    html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>Security Alert: New Sign-In</title>
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
        .alert-details { background-color:#fff3cd; border-left:4px solid #ffeeba; padding:15px; margin:15px 0; }
        .button-danger { background-color:#dc3545; color:#ffffff; padding:12px 25px; text-decoration:none; border-radius:5px; display:inline-block; font-weight:bold; }
        .footer-links a { color:#777777; text-decoration:underline; }

        /* Responsive Styles */
        @media screen and (max-width:600px) {
          .content { padding:15px!important; }
          .main { width:100%!important; }
          .logo { width:280px!important; height:auto!important; }
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
                    <h2 style="margin:0 0 20px 0;font-size:24px;font-weight:bold;color:#333333;">
                      Security Alert: New Sign-In Detected
                    </h2>
                    <p style="font-size:16px;line-height:1.5;color:#555555;margin:0 0 10px 0;">
                      Hello ${firstName},<br><br>
                      We’re writing to inform you of a recent sign-in to your 24 Hour Truck Services account.
                    </p>

                    <!-- ALERT DETAILS -->
                    <table class="alert-details" width="100%" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="font-size:14px;color:#856404;line-height:1.5;">
                          <strong>Time:</strong> ${timeOfLogin}<br>
                          <strong>Device:</strong> ${deviceType}<br>
                          <strong>Location:</strong> ${location} (approximate)
                        </td>
                      </tr>
                    </table>

                    <p style="font-size:16px;line-height:1.5;color:#555555;margin:0 0 20px 0;">
                      If this was you, you can safely ignore this email. There’s nothing more you need to do.<br><br>
                      If this was not you, please secure your account immediately by resetting your password.
                    </p>

                    <p style="text-align:center;margin:0 0 20px 0;">
                      <a
                        href="${process.env.NEXT_PUBLIC_BASE_URL}/auth/forgot-password"
                        target="_blank"
                        class="button-danger"
                        style="font-size:16px;font-family:Arial,sans-serif;color:#ffffff;text-decoration:none;padding:15px 25px;border-radius:5px;display:inline-block;font-weight:bold;"
                      >
                        Reset Your Password
                      </a>
                    </p>

                    <p style="font-size:16px;line-height:1.5;color:#555555;margin:0;">
                      If you need more help or have any questions, please don’t hesitate to contact our support team.<br><br>
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
    console.log("✅ Security alert email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Error sending security alert email:", error);
    throw error;
  }
};
/**
 * Sends a generic email using the company template format.
 * Supports both object format and individual parameters for backward compatibility.
 *
 * @param {Object|string} params - Either an object with email properties or the 'to' email address
 * @param {string} [params.to] — recipient email address
 * @param {string} [params.subject] — email subject line
 * @param {string} [params.body] — HTML body content (will be inserted into template)
 * @param {string} [params.title] — optional title/heading for the email
 * @param {string} [subject] — email subject (when using individual parameters)
 * @param {string} [body] — email body (when using individual parameters)
 */
const sendGenericEmail = async (params, subject, body) => {
  let emailData;
  if (typeof params === 'object' && params !== null) {
    emailData = params;
  } else {
    emailData = {
      to: params,
      subject: subject,
      body: body
    };
  }

  const { to, subject: emailSubject, body: emailBody, title } = emailData;
  const processedBody = title ? `
    <h2 style="margin:0 0 20px 0;font-size:24px;font-weight:bold;color:#333333;">
      ${title}
    </h2>
    <div style="font-size:16px;line-height:1.5;color:#555555;">
      ${emailBody}
    </div>
  ` : emailBody;

  const mailOptions = {
    from: process.env.FROM_EMAIL,
    to,
    subject: emailSubject,
    html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>${emailSubject}</title>
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
        .alert-details { background-color:#fff3cd; border-left:4px solid #ffeeba; padding:15px; margin:15px 0; }
        .button-primary { background-color:#007bff; color:#ffffff; padding:12px 25px; text-decoration:none; border-radius:5px; display:inline-block; font-weight:bold; }
        .button-danger { background-color:#dc3545; color:#ffffff; padding:12px 25px; text-decoration:none; border-radius:5px; display:inline-block; font-weight:bold; }
        .button-success { background-color:#28a745; color:#ffffff; padding:12px 25px; text-decoration:none; border-radius:5px; display:inline-block; font-weight:bold; }
        .info-box { background-color:#d1ecf1; border-left:4px solid #bee5eb; padding:15px; margin:15px 0; color:#0c5460; }
        .warning-box { background-color:#fff3cd; border-left:4px solid #ffeeba; padding:15px; margin:15px 0; color:#856404; }
        .success-box { background-color:#d4edda; border-left:4px solid #c3e6cb; padding:15px; margin:15px 0; color:#155724; }
        .footer-links a { color:#777777; text-decoration:underline; }

        /* Responsive Styles */
        @media screen and (max-width:600px) {
          .content { padding:15px!important; }
          .main { width:100%!important; }
          .logo { width:280px!important; height:auto!important; }
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
                    ${processedBody}
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
    console.log("✅ Email sent successfully:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Error sending email:", error);
    throw error;
  }
};


module.exports = { sendSigninEmail, sendGenericEmail };
