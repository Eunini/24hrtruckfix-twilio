const transporter = require('./emailTransporter');
const path = require("path");

const sendAccountApprovalPendingEmail = async (to, username, clientType) => {
  const mailOptions = {
    from: process.env.FROM_EMAIL,
    to,
    subject: "Welcome to 24 Hour Truck Services! Your Account is Under Review",
    html: `
    <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
      <center style="width:100%;background-color:#f4f4f4;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr>
            <td align="center">
              <table style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;border-collapse:collapse;" cellpadding="0" cellspacing="0" role="presentation">
                
                <!-- HEADER -->
                <tr>
                  <td align="center" style="background:#ffffff;padding:20px;">
                    <a href="https://24hrtruckfix.com" target="_blank">
                      <img
                        src="cid:logo@24hrs"
                        alt="24 Hour Truck Services Logo"
                        width="300"
                        style="display:block;border:0;max-width:100%;height:auto;"
                        class="logo"
                      >
                    </a>
                  </td>
                </tr>

                <!-- BODY -->
                <tr>
                  <td style="padding:30px 40px;color:#4a4a4a;">
                    <h2 style="margin:0 0 20px 0;font-size:24px;font-weight:bold;color:#333333;">
                      Welcome! Your Account is Under Review.
                    </h2>
                    <p style="margin:0 0 20px 0;font-size:16px;line-height:1.5;color:#555555;">
                      Hello ${username},<br><br>
                      Thank you for signing up with 24 Hour Truck Services! We're excited to have you on board.
                    </p>
                    <p style="margin:0 0 20px 0;font-size:16px;line-height:1.5;color:#555555;">
                      We are currently reviewing your <strong>${clientType}</strong> account details to ensure everything is set up correctly. This process is usually completed quickly, and we'll send you another email with an update within the next 24 hours.
                    </p>
                    <p style="text-align:center;margin:0 0 20px 0;">
                      <a
                        href="https://24hrtruckfix.com"
                        target="_blank"
                        style="
                          background-color:#007bff;
                          color:#ffffff;
                          padding:12px 25px;
                          text-decoration:none;
                          border-radius:5px;
                          display:inline-block;
                          font-weight:bold;
                        "
                      >
                        Visit Our Website
                      </a>
                    </p>
                    <p style="margin:0 0 0 0;font-size:16px;line-height:1.5;color:#555555;">
                      If you have any immediate questions, feel free to contact our support team.<br><br>
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
                    <a href="https://example.com/unsubscribe" target="_blank" style="color:#777777;text-decoration:underline;">Unsubscribe</a>
                    &nbsp;|&nbsp;
                    <a href="mailto:support@24hrtruckfix.com" target="_blank" style="color:#777777;text-decoration:underline;">Support</a>
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
    console.log("Account review pending email sent successfully");
  } catch (error) {
    console.error("Error sending account review pending email:", error);
  }
};

module.exports = { sendAccountApprovalPendingEmail };
