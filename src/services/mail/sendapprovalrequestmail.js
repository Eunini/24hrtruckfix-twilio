const transporter = require('./emailTransporter');
const path = require("path");

const sendApprovalRequestEmail = async (userType, username) => {
    const mailOptions = {
      from: process.env.FROM_EMAIL,
      to: process.env.TO_EMAIL,
      subject: "New User Awaiting Approval",
      html: `
      <body style="margin: 0; padding: 0; background: #f9fafb;">
        <table style="max-width: 600px; width: 100%; margin: 0 auto; position: relative; padding-top: 30px; top: 20px; box-shadow: 0 0px 22px 0px #bebebe40;" cellspacing="0" cellpadding="0">
          <tbody style="margin: 30px 0px; background: #fff;">
            <tr>
              <td style="text-align: center; padding: 10px 20px; background-color: #1461eb;">
                <img src="cid:logo@24hrs" alt="24hrs Logo" style="max-width: 120px; width: 100%; height: auto;">
              </td>
            </tr>
            <tr>
              <td style="text-align: center; padding: 20px;">
                <h3 style="font-family: 'Inter', sans-serif; font-weight: 800; font-size: 18px; color: rgb(0, 83, 83); margin: 0;">New User Approval Request</h3>
                <p style="font-family: 'Inter', sans-serif; font-weight: 400; font-size: 16px; color: #012929; margin: 26px 0 0 0; text-align: left;">
                  A new user account has been created and is awaiting your approval.
                </p>
                <p style="font-family: 'Inter', sans-serif; font-weight: 400; font-size: 16px; color: #012929; margin: 20px 0; text-align: left;">
                  <strong>Username:</strong> ${username} <br>
                  <strong>User Role:</strong> ${userType}
                </p>
                <p style="font-family: 'Inter', sans-serif; font-weight: 400; font-size: 16px; color: #012929; margin: 20px 0; text-align: left;">
                  Please review and approve this account to grant access to our platform.
                </p>
                <p style="font-family: 'Inter', sans-serif; font-weight: 400; font-size: 16px; color: #012929; margin: 20px 0; text-align: left;">
                  You can manage pending approvals in the admin portal.
                </p>
              </td>
            </tr>
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
      console.log("Approval request email sent successfully");
    } catch (error) {
      console.error("Error sending approval request email:", error);
    }
  };

  
  module.exports = {
    sendApprovalRequestEmail, 
  };