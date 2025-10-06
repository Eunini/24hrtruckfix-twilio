const transporter = require('./emailTransporter');
const path = require("path");

const sendForgotPasswordEmail = async (email, otp) => {
  const mailOptions = {
    from: process.env.FROM_EMAIL,
    to: email,
    subject: "Password Reset Request - 24hrs Service",
       html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="X-UA-Compatible" content="IE=edge" />
          <title>Your Password Reset Code</title>
          <style>
              body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
              table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
              img { -ms-interpolation-mode:bicubic; border:0; height:auto; line-height:100%; outline:none; text-decoration:none; }
              table { border-collapse:collapse !important; }
              body { height:100% !important; margin:0 !important; padding:0 !important; width:100% !important; background-color:#f4f4f4; font-family:Arial, sans-serif; }

              .main { background:#fff; margin:0 auto; width:100%; max-width:600px; }
              .content { padding:20px 30px; }
              .otp-box { background:#f0f8ff; border:1px dashed #007bff; padding:20px; border-radius:8px; margin:20px 0; }
              .otp-code { font-size:36px; font-weight:bold; color:#004a99; letter-spacing:5px; text-align:center; }
              .footer-links a { color:#777; text-decoration:underline; }

              @media screen and (max-width:600px) {
                  .content { padding:15px !important; }
                  .main { width:100% !important; }
                  .logo { width:280px !important; height:auto !important; }
                  .otp-code { font-size:28px !important; letter-spacing:3px !important; }
              }
          </style>
      </head>
      <body>
        <center style="width:100%; background-color:#f4f4f4;">
          <table class="main" cellpadding="0" cellspacing="0" role="presentation">
            <!-- HEADER -->
            <tr>
              <td align="center" style="padding:20px; background:#fff;">
                <a href="https://24hrtruckfix.com" target="_blank">
                  <img src="cid:logo" alt="Company Logo" width="300" class="logo" style="display:block; border:0;" />
                </a>
              </td>
            </tr>
            <!-- BODY -->
            <tr>
              <td class="content">
                <h2 style="font-size:24px; color:#333; margin-bottom:20px;">Your Password Reset Code</h2>
                <p style="font-size:16px; line-height:1.5; color:#555;">
                  Hello,<br><br>
                  We received a request to reset your password. Use the code below to complete the process.
                </p>
                <div class="otp-box">
                  <div class="otp-code">{{OTP}}</div>
                </div>
                <p style="font-size:16px; line-height:1.5; color:#555;">
                  This code will expire in 10 minutes.<br><br>
                  If you did not request a password reset, you can safely ignore this email. Your password will not be changed.<br><br>
                  Best regards,<br>
                  The 24 Hour Truck Services Team
                </p>
              </td>
            </tr>
            <!-- FOOTER -->
            <tr>
              <td style="background:#eee; padding:30px; text-align:center; font-size:12px; color:#777;">
                24 Hour Truck Services<br>
                300 Delaware Ave, Suite 210 #382, Wilmington DE 19801<br><br>
                <a href="https://example.com/unsubscribe" target="_blank">Unsubscribe</a> |
                <a href="mailto:support@24hrtruckfix.com" target="_blank">Support</a><br><br>
                &copy; ${new Date().getFullYear()} 24 Hour Truck Services. All rights reserved.
              </td>
            </tr>
          </table>
        </center>
      </body>
      </html>
    `.replace('{{OTP}}', otp),
    attachments: [
      {
        filename: "logo.png",
        path: path.join(__dirname, "../..//assets/logo.png"), // Path to the logo file
        cid: "logo", // Same as the cid used in the img tag
      },
    ],
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Password reset OTP email sent successfully");
  } catch (error) {
    console.error("Error sending password reset email:", error);
  }
};


module.exports = {
  sendForgotPasswordEmail,
};
