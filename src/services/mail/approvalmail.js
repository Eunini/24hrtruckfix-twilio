const transporter = require("./emailTransporter");
const path = require("path");

const sendApprovalEmail = async ({ to, firstName }) => {
  const mailOptions = {
    from: process.env.FROM_EMAIL,
    to,
    subject: "Your 24 Hour Truck Services Account is Approved!",
    html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>Your Account is Approved!</title>
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
        .button-success { background-color:#28a745; color:#ffffff; padding:12px 25px; text-decoration:none; border-radius:5px; display:inline-block; font-weight:bold; }
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
                      Great News! Your Account is Approved.
                    </h2>
                    <p style="font-size:16px;line-height:1.5;color:#555555;margin:0 0 20px 0;">
                      Hello ${firstName},<br><br>
                      We're happy to let you know that your account with 24 Hour Truck Services has been approved and is now active!<br><br>
                      This means you now have full access to our network of <strong>24/7 roadside assistance for your drivers, anywhere across the continental USA.</strong>
                      You can now sign in to your account to manage your fleet and services.
                    </p>
                    <p style="text-align:center;margin:0 0 20px 0;">
                      <a
                        href="${process.env.NEXT_PUBLIC_BASE_URL}/auth/signin"
                        target="_blank"
                        class="button-success"
                        style="font-size:16px;font-family:Arial,sans-serif;color:#ffffff;text-decoration:none;padding:15px 25px;border-radius:5px;display:inline-block;font-weight:bold;"
                      >
                        Sign In to Your Account
                      </a>
                    </p>
                    <p style="font-size:16px;line-height:1.5;color:#555555;margin:0;">
                      We're excited to have you with us. If you have any questions about getting started, please contact our support team.<br><br>
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
                    <a href="mailto:Service@24hrtruckfix.com" target="_blank">Support</a>
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
    console.log("✅ Approval email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Error sending approval email:", error);
    throw error;
  }
};

const sendUserInviteEmail = async ({ email, firstName, password, clientType }) => {
  const mailOptions = {
    from: `"@24hrTruckService" <${process.env.ADMIN_EMAIL_AUTH_USER}>`,
    to: email,
    subject: "Welcome! Your 24 Hour Truck Services Account is Ready",
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <title>Welcome! Your 24 Hour Truck Services Account is Ready</title>
          <style>
              /* General Reset */
              body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
              table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
              img { -ms-interpolation-mode:bicubic; border:0; height:auto; line-height:100%; outline:none; text-decoration:none; }
              table { border-collapse:collapse!important; }
              body { margin:0!important; padding:0!important; width:100%!important; background-color:#f4f4f4; font-family:Arial,sans-serif; }

              .main { background-color:#ffffff; margin:0 auto; width:100%; max-width:600px; }
              .content { padding:20px 30px; }
              .button { background-color:#007bff; color:#ffffff; padding:12px 25px; text-decoration:none; border-radius:5px; display:inline-block; font-weight:bold; }
              .credentials-box { background-color:#f9f9f9; border:1px solid #dddddd; padding:15px; border-radius:5px; margin:10px 0; }
              .footer-links a { color:#777777; text-decoration:underline; }

              @media screen and (max-width:600px) {
                .content { padding:15px!important; }
                .main { width:100%!important; }
                .logo { width:280px!important; height:auto!important; }
              }
          </style>
      </head>
      <body>
        <center style="width:100%; background-color:#f4f4f4;">
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
                      <h1 style="font-size:24px; font-weight:bold; color:#333333; margin:0 0 20px;">
                        Welcome! Your Account is Active.
                      </h1>
                      <p style="font-size:16px; line-height:1.5; color:#555555; margin:0 0 20px;">
                        Hello ${firstName},<br><br>
                        Welcome to 24 Hour Truck Services! An account has been created for you as a <strong>${clientType}</strong>, and it is now active.
                        <br><br>
                        Here are your temporary login credentials:
                      </p>

                      <table class="credentials-box" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation">
                        <tr>
                          <td style="font-size:16px; color:#555555; font-family:Arial,sans-serif;">
                            <strong>Email:</strong> ${email}<br>
                            <strong>Password:</strong> ${password}
                          </td>
                        </tr>
                      </table>

                      <p style="font-size:16px; line-height:1.5; color:#555555; margin:10px 0 20px;">
                        For your security, we strongly recommend that you change your password after logging in for the first time.
                      </p>

                      <p style="text-align:center; margin:0 0 20px;">
                        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/auth/signin" target="_blank" class="button">
                          Login to Your Account
                        </a>
                      </p>

                      <p style="font-size:16px; line-height:1.5; color:#555555; margin:0;">
                        We're excited to start working with you.<br><br>
                        Best regards,<br>
                        The 24 Hour Truck Services Team
                      </p>
                    </td>
                  </tr>

                  <!-- FOOTER -->
                  <tr>
                    <td style="background-color:#eeeeee; padding:30px; font-size:12px; color:#777777; text-align:center; line-height:1.5;">
                      24 Hour Truck Services<br>
                      300 Delaware Ave, Suite 210 #382, Wilmington DE 19801<br><br>
                      <a href="https://example.com/unsubscribe" target="_blank">Unsubscribe</a> |
                      <a href="mailto:support@24hrtruckfix.com" target="_blank">Support</a><br><br>
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
    console.log("✅ Client Invite email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Error sending invite email:", error);
    throw error;
  }
};

const sendInviteEmail = async ({ email, firstName, password, numberOfOrgs }) => {
  const mailOptions = {
    from: `"@24hrTruckService" <${process.env.ADMIN_EMAIL_AUTH_USER}>`,
    to: email,
    subject: "🚀 You've Been Invited to Join 24 Hour Truck Services",
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <title>You're Invited!</title>
          <style>
              body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
              table, td { mso-table-lspace:0; mso-table-rspace:0; }
              img { -ms-interpolation-mode:bicubic; border:0; height:auto; line-height:100%; outline:none; text-decoration:none; }
              table { border-collapse:collapse!important; }
              body { margin:0!important; padding:0!important; width:100%!important; background:#f4f4f4; font-family:Arial,sans-serif; }
              .main { background:#fff; margin:0 auto; max-width:600px; width:100%; }
              .content { padding:20px 30px; }
              .button { background:#007bff; color:#fff; padding:12px 25px; text-decoration:none; border-radius:5px; display:inline-block; font-weight:bold; }
              .credentials-box { background:#f9f9f9; border:1px solid #ddd; padding:15px; border-radius:5px; margin:10px 0; }
              .footer-links a { color:#777; text-decoration:underline; }
              @media screen and (max-width:600px) {
                .content { padding:15px!important; }
                .main { width:100%!important; }
                .logo { width:280px!important; height:auto!important; }
              }
          </style>
      </head>
      <body>
        <center style="width:100%;background:#f4f4f4;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td align="center">
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
                        />
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td class="content" style="background:#fff;">
                      <h1 style="font-size:24px;color:#333;margin:0 0 20px;">
                        You've Been Invited to Join!
                      </h1>
                      <p style="font-size:16px;line-height:1.5;color:#555;">
                        Hello ${firstName},<br><br>
                        Welcome to the team! You have been invited to manage
                        <strong>${numberOfOrgs}</strong> organization(s) on the 24 Hour Truck Services platform.
                        <br><br>
                        Please use the following credentials to log in to your new agent account:
                      </p>
                      <table class="credentials-box" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                        <tr>
                          <td style="font-size:16px;color:#555;">
                            <strong>Email:</strong> ${email}<br>
                            <strong>Password:</strong> ${password}
                          </td>
                        </tr>
                      </table>
                      <p style="font-size:16px;line-height:1.5;color:#555;margin:10px 0 20px;">
                        For your security, we strongly recommend that you change your password after logging in for the first time.
                      </p>
                      <p style="text-align:center;margin-bottom:20px;">
                        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/auth/signin" target="_blank" class="button">
                          Login to Your Account
                        </a>
                      </p>
                      <p style="font-size:16px;line-height:1.5;color:#555;">
                        We're excited to have you on board.<br><br>
                        Best regards,<br>
                        The 24 Hour Truck Services Team
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="background:#eeeeee;padding:30px;font-size:12px;color:#777;text-align:center;line-height:1.5;">
                      24 Hour Truck Services<br>
                      300 Delaware Ave, Suite 210 #382, Wilmington DE 19801<br><br>
                      <a href="https://example.com/unsubscribe" target="_blank">Unsubscribe</a> |
                      <a href="mailto:support@24hrtruckfix.com" target="_blank">Support</a><br><br>
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
        filename: 'logo.png',
        path: path.join(__dirname, '../../assets/logo.png'),
        cid: 'logo',
      },
    ],
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Invite email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Error sending invite email:", error);
    throw error;
  }
};

const sendTaskAssignedEmail = async ({
  supportEmail,
  bccList = [],
  recipientName,
  clientName,
  taskTitle,
  taskDescription,
}) => {
  const mailOptions = {
    from: `"@24hrTruckService" <${process.env.ADMIN_EMAIL_AUTH_USER || process.env.FROM_EMAIL}>`,
    to: supportEmail,
    bcc: bccList,
    subject: "🔔 New Task Assigned",
    html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>New Task Assigned</title>
      <style>
        body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
        table, td { mso-table-lspace:0; mso-table-rspace:0; }
        img { -ms-interpolation-mode:bicubic; border:0; height:auto; line-height:100%; outline:none; text-decoration:none; }
        table { border-collapse:collapse!important; }
        body { margin:0!important; padding:0!important; width:100%!important; background-color:#f4f4f4; font-family:Arial,sans-serif; }
        .main { background-color:#ffffff; margin:0 auto; width:100%; max-width:600px; color:#4a4a4a; }
        .content { padding:20px 30px; }
        .button { background-color:#007bff; color:#ffffff; padding:12px 25px; text-decoration:none; border-radius:5px; display:inline-block; font-weight:bold; }
        .task-details-box { background-color:#f8f9fa; border-left:4px solid #007bff; padding:20px; margin:20px 0; }
        .footer-links a { color:#777777; text-decoration:underline; }
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
          <tr><td align="center">
            <table class="main" width="600" cellpadding="0" cellspacing="0" role="presentation">
              
              <!-- HEADER -->
              <tr>
                <td align="center" style="background-color:#ffffff;padding:20px;">
                  <a href="https://24hrtruckfix.com" target="_blank">
                    <img
                      src="cid:logo@24hrs"
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
                    A New Task Has Been Assigned
                  </h2>
                  <p style="font-size:16px;line-height:1.5;color:#555555;margin:0 0 20px 0;">
                    Hello ${recipientName},<br><br>
                    A new task has been created and assigned to you. Please review the details below.
                  </p>
                  
                  <table class="task-details-box" width="100%" cellpadding="0" cellspacing="0" role="presentation">
                    <tr>
                      <td style="font-size:16px;color:#333333;padding:10px;">
                        <strong style="color:#007bff;">Client:</strong> ${clientName}<br><br>
                        <strong style="color:#007bff;">Task:</strong> ${taskTitle}<br><br>
                        <strong style="color:#007bff;">Description:</strong><br>
                        ${taskDescription}
                      </td>
                    </tr>
                  </table>
                  
                  <p style="text-align:center;padding-top:20px;padding-bottom:20px;">
                    <a
                      href="${process.env.NEXT_PUBLIC_BASE_URL}/tasks"
                      target="_blank"
                      class="button"
                      style="font-size:16px;font-family:Arial,sans-serif;color:#ffffff;text-decoration:none;padding:15px 25px;border-radius:5px;display:inline-block;font-weight:bold;"
                    >
                      View Task in Portal
                    </a>
                  </p>
                  
                  <p style="font-size:16px;line-height:1.5;color:#555555;margin:20px 0 0 0;">
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
          </td></tr>
        </table>
      </center>
    </body>
    </html>
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
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Task assigned email sent:", info.messageId);
    return info;
  } catch (err) {
    console.error("❌ Error sending task email:", err);
    throw err;
  }
};

module.exports = {
  sendApprovalEmail,
  sendInviteEmail,
  sendUserInviteEmail,
  sendTaskAssignedEmail,
};
