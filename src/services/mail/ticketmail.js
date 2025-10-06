const transporter = require('./emailTransporter');
const path = require('path');

async function sendSpecialTicketEmail(toEmail, client, policyId) {
  const mailOptions = {
    from: process.env.FROM_EMAIL,
    to: toEmail,
    subject: `Special Ticket Created for ${client}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <title>Special Ticket Created</title>
          <style>
            /* General Reset */
            body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
            table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
            img { -ms-interpolation-mode:bicubic; border:0; height:auto; line-height:100%; outline:none; text-decoration:none; }
            table { border-collapse:collapse !important; }
            body { margin:0!important; padding:0!important; width:100%!important; background:#f4f4f4; font-family:Arial,sans-serif; }
            .main { background:#fff; margin:0 auto; max-width:600px; width:100%; }
            .content { padding:20px 30px; }
            .ticket-id-box { background:#f8f9fa; border:1px solid #dee2e6; padding:15px; border-radius:5px; text-align:center; margin:15px 0; }
            .ticket-id { font-family:'Courier New', Courier, monospace; font-size:20px; font-weight:bold; color:#343a40; }
            .automated-message { font-style:italic; font-size:14px; color:#6c757d; }
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
                      A Special Ticket Has Been Created
                    </h1>
                    <p style="font-size:16px;line-height:1.5;color:#555;">
                      Hello,<br><br>
                      We’re writing to inform you that a special ticket has been created to address your recent request. This means we are authorizing our team to go outside the normal bounds of our contract to ensure your issue is resolved as quickly and effectively as possible.
                    </p>
                    <table class="ticket-id-box" cellpadding="0" cellspacing="0" role="presentation" width="100%">
                      <tr>
                        <td style="font-size:16px;color:#343a40;font-family:Arial,sans-serif;">
                          Ticket ID created for ${client}:
                          <div class="ticket-id">${policyId}</div>
                        </td>
                      </tr>
                    </table>
                    <p style="font-size:16px;line-height:1.5;color:#555;margin-top:20px;">
                      Our team will begin working on this immediately and will provide updates as they become available.<br><br>
                      <span class="automated-message">*This is an automated message.*</span><br><br>
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
    console.log(`Special Ticket email sent to ${toEmail}`);
  } catch (err) {
    console.error('Error sending Special Ticket email:', err);
  }
}

module.exports = { sendSpecialTicketEmail };
