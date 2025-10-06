const transporter = require('./emailTransporter');
const path = require("path");

const sendVerificationEmail = async (email, username, token) => {
  const mailOptions = {
    from: process.env.FROM_EMAIL,
    to: email,
    subject: "Your One-Time Password for 24 Hour Truck Services",
    html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>Your One-Time Password</title>
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
        .otp-box { background-color:#f0f8ff; border:1px dashed #007bff; padding:20px; border-radius:8px; margin:20px 0; }
        .otp-code { font-size:36px; font-weight:bold; color:#004a99; letter-spacing:5px; text-align:center; }
        .footer-links a { color:#777777; text-decoration:underline; }

        /* Responsive Styles */
        @media screen and (max-width:600px) {
          .content { padding:15px!important; }
          .main { width:100%!important; }
          .logo { width:280px!important; height:auto!important; }
          .otp-code { font-size:28px!important; letter-spacing:3px!important; }
        }
      </style>
    </head>
    <body>
      <center style="width:100%;background-color:#f4f4f4;">
        <table width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td align="center">
              <table class="main" width="600" border="0" cellpadding="0" cellspacing="0" role="presentation">
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
                      Your Secure Login Code
                    </h2>
                    <p style="font-size:16px;line-height:1.5;color:#555555;margin:0 0 10px 0;">
                      Hello ${username},<br><br>
                      A login attempt requires a one-time password. Please use the code below to complete your sign-in.
                    </p>

                    <!-- OTP BOX -->
                    <table class="otp-box" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td class="otp-code" style="font-family:'Courier New', Courier, monospace;">
                          {${token}}
                        </td>
                      </tr>
                    </table>

                    <p style="font-size:16px;line-height:1.5;color:#555555;margin:20px 0 0 0;">
                      This code will expire in 10 minutes.<br><br>
                      If you did not request this code, please disregard this email or contact our support team immediately if you have security concerns.<br><br>
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
    await transporter.sendMail(mailOptions);
    console.log("Verification email sent successfully");
  } catch (error) {
    console.error("Error sending verification email:", error);
    throw error;
  }
};

const sendAiConciergeEmail = async(email, orgName, phone) => {
  const mailOptions = {
    from: process.env.FROM_EMAIL,
    to: email,
    subject: 'Exciting Update: Your AI Concierge Agent is Now Live!',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <title>Your AI Concierge is Live!</title>
          <style>
            /* ... your CSS from above ... */
          </style>
      </head>
      <body style="background-color: #f4f4f4; margin: 0 !important; padding: 0 !important;">
        <center style="width: 100%; background-color: #f4f4f4;">
          <table width="100%" cellspacing="0" cellpadding="0" role="presentation">
            <tr><td align="center">
              <table width="600" class="main" cellspacing="0" cellpadding="0" role="presentation" style="max-width:600px;margin:0 auto;background:#fff;">
                <tr>
                  <td align="center" style="padding:20px;background:#fff;">
                    <a href="https://24hrtruckfix.com" target="_blank">
                      <img src="cid:logo" alt="Company Logo" width="300" class="logo" style="display:block;border:0;">
                    </a>
                  </td>
                </tr>
                <tr>
                  <td class="content" style="padding:30px 40px;">
                    <h1 style="font-size:24px;color:#333;margin:0 0 20px;">Introducing Your AI Concierge Agent</h1>
                    <p style="font-size:16px;line-height:1.5;color:#555;font-family:Arial,sans-serif;">
                      Hello,<br><br>
                      We’re thrilled to announce that the <strong>AI Concierge Agent for ${orgName}</strong> is now active! This powerful new feature is designed to streamline your support process and get your drivers help even faster.<br><br>
                      Your drivers can now call the dedicated number below to make a report. Our AI agent will immediately answer, validate their details, collect information about the issue, and automatically create a support ticket for our team to begin work.
                    </p>
                    <table class="phone-number-box" width="100%" cellspacing="0" cellpadding="0" style="background:#e9ecef;border:1px solid #ced4da;border-radius:5px;margin:15px 0;padding:15px;text-align:center;">
                      <tr>
                        <td>
                          <div style="font-size:14px;color:#343a40;font-family:Arial,sans-serif;">
                            Your AI Concierge Phone Number:
                          </div>
                          <div class="phone-number" style="font-family:'Courier New',Courier,monospace;font-size:24px;font-weight:bold;color:#343a40;letter-spacing:2px;padding-top:5px;">
                            ${phone}
                          </div>
                        </td>
                      </tr>
                    </table>
                    <p style="font-size:16px;line-height:1.5;color:#555;font-family:Arial,sans-serif;">
                      And don’t worry, if anything requires a human touch, the AI Concierge can always escalate the call to one of our live representatives.<br><br>
                      Please share this number with your drivers and let us know if you have any questions.<br><br>
                      Best regards,<br>
                      The 24 Hour Truck Services Team
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background-color:#eeeeee;padding:30px;font-size:12px;color:#777;font-family:Arial,sans-serif;text-align:center;line-height:1.5;">
                    24 Hour Truck Services<br>
                    300 Delaware Ave, Suite 210 #382, Wilmington DE 19801<br><br>
                    <a href="https://example.com/unsubscribe" style="color:#777;text-decoration:underline;">Unsubscribe</a> |
                    <a href="mailto:support@24hrtruckfix.com" style="color:#777;text-decoration:underline;">Support</a><br><br>
                    &copy; ${new Date().getFullYear()} 24 Hour Truck Services. All rights reserved.
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </center>
      </body>
      </html>
    `,
    attachments: [
      {
        filename: 'logo.png',
        path: path.join(__dirname, '../../assets/logo.png'),
        cid: 'logo',
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ AI Concierge email sent to ${email}`);
  } catch (err) {
    console.error('❌ Error sending AI Concierge email:', err);
  }
}

 const sendAiDispatchEmail = async(email, orgName, outboundNumber) => {
  const mailOptions = {
    from: process.env.FROM_EMAIL,
    to: email,
    subject: 'Major Upgrade: Your AI Dispatch Agent is Now Active!',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <title>Your AI Dispatch Agent is Live!</title>
          <style>
            /* General Reset */
            body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
            table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
            img { -ms-interpolation-mode:bicubic; border:0; height:auto; line-height:100%; outline:none; text-decoration:none; }
            table { border-collapse:collapse !important; }
            body { height:100% !important; margin:0 !important; padding:0 !important; width:100% !important; background:#f4f4f4; font-family:Arial,sans-serif; }
            .main { background:#fff; margin:0 auto; max-width:600px; width:100%; }
            .content { padding:20px 30px; }
            .features-list { padding-left:20px; }
            .features-list li { padding-bottom:15px; line-height:1.5; }
            .footer-links a { color:#777; text-decoration:underline; }
            @media screen and (max-width:600px) {
              .content { padding:15px !important; }
              .main { width:100% !important; }
              .logo { width:280px !important; height:auto !important; }
            }
          </style>
      </head>
      <body>
        <center style="width:100%;background:#f4f4f4;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr><td align="center">
              <table class="main" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td align="center" style="padding:20px;background:#fff;">
                    <a href="https://24hrtruckfix.com" target="_blank">
                      <img
                        src="cid:logo"
                        alt="Company Logo"
                        width="300"
                        class="logo"
                        style="display:block;border:0;"
                      >
                    </a>
                  </td>
                </tr>
                <tr>
                  <td class="content" style="padding:30px 40px;background:#fff;">
                    <h1 style="font-size:24px;color:#333;margin:0 0 20px;">
                      Major Upgrade: Your AI Dispatch Agent is Active!
                    </h1>
                    <p style="font-size:16px;line-height:1.5;color:#555;">
                      Hello,<br><br>
                      We’re excited to announce a significant enhancement for <strong>${orgName}</strong>. Your new <strong>AI Dispatch Agent</strong> is now live, automating and accelerating how your drivers get help.<br><br>
                      Here’s what this means for you and your drivers:
                    </p>
                    <ul class="features-list" style="font-size:16px;color:#555;">
                      <li><strong>Automated High-Speed Dispatch:</strong> The process of finding service providers is now fully automated. Our system can contact up to 50 mechanics at once to find the fastest help for your vehicle's issues.</li>
                      <li><strong>Real-Time SMS Updates:</strong> Your drivers will receive automatic, real-time status updates via text. They can also call <strong>${outboundNumber}</strong> for instant updates.</li>
                      <li><strong>Live Technician Tracking:</strong> Just like Uber, your drivers can now track how far away help is in real-time on a map, giving them peace of mind and an accurate ETA.</li>
                    </ul>
                    <p style="font-size:16px;line-height:1.5;color:#555;margin-top:20px;">
                      This upgrade is designed to minimize downtime and improve the service experience for your drivers.<br><br>
                      Best regards,<br>
                      The 24 Hour Truck Services Team
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#eeeeee;padding:30px;font-size:12px;color:#777;text-align:center;line-height:1.5;">
                    24 Hour Truck Services<br>
                    300 Delaware Ave, Suite 210 #382, Wilmington DE 19801<br><br>
                    <a href="https://example.com/unsubscribe" style="color:#777;text-decoration:underline;">Unsubscribe</a> |
                    <a href="mailto:support@24hrtruckfix.com" style="color:#777;text-decoration:underline;">Support</a><br><br>
                    &copy; ${new Date().getFullYear()} 24 Hour Truck Services. All rights reserved.
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </center>
      </body>
      </html>
    `,
    attachments: [
      {
        filename: 'logo.png',
        path: path.join(__dirname, '../../assets/logo.png'),
        cid: 'logo',
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ AI Dispatch email sent to ${email}`);
  } catch (err) {
    console.error('❌Error sending AI Dispatch email:', err);
  }
}

module.exports = {
  sendVerificationEmail, 
  sendAiConciergeEmail,
  sendAiDispatchEmail
};
