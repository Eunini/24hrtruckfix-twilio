const transporter = require('./emailTransporter');
const path = require("path");

const sendWelcomeEmail = async (to, username) => {
  const mailOptions = {
    from: process.env.FROM_EMAIL,
    to: to,
    subject: "Welcome to Our 24hr Service",
    html: ` <body style="margin: 0; padding: 0; background: #f9fafb;">
    <table style="max-width: 600px; width: 100%; margin: 0 auto; position: relative; padding-top: 30px; top: 20px; box-shadow: 0 0px 22px 0px #bebebe40;" cellspacing="0" cellpadding="0">
        <tbody style="margin: 30px 0px; background: #fff;">
            <tr>
                <td style="text-align: center; padding: 10px 20px; background-color: #1461eb;">
                    <img src="cid:logo@24hrs" alt="24hrs Logo" style="max-width: 120px; width: 100%; height: auto;">
                </td>
            </tr>
            <tr>
                <td style="text-align: center; padding: 20px;">
                    <h3 style="font-family: 'Inter', sans-serif; font-weight: 800; font-size: 18px; color: rgb(0, 83, 83); margin: 0;">Hello ${username},</h3>
                    <p style="font-family: 'Inter', sans-serif; font-weight: 400; font-size: 16px; color: #012929; margin: 26px 0 0 0; text-align: left;">
                       Your account has been created successfully.
                    </p>
                    <p style="font-family: 'Inter', sans-serif; font-weight: 400; font-size: 16px; color: #012929; margin: 20px 0; text-align: left;">
                        Username: ${username}
                    </p>
                    <p style="font-family: 'Inter', sans-serif; font-weight: 400; font-size: 16px; color: #012929; margin: 20px 0; text-align: left;">
                        If you would like to reset your password, please click the link below and follow the instructions:
                    </p>
                    <p style="font-family: 'Inter', sans-serif; font-weight: 400; font-size: 16px; color: #012929; margin: 20px 0; text-align: left;">
                        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/forgotpassword" style="color: rgb(0, 83, 83); font-weight: 600; text-decoration: underline;">Set Your Password</a>
                    </p>
                </td>
            </tr>
            <tr>
                <td style="padding: 0 20px;">
                    <p style="font-family: 'Inter', sans-serif; font-weight: 400; font-size: 16px; color: #012929; margin-bottom: 22px; text-align: left;">
                        If you have any questions or need assistance, please don't hesitate to contact us at
                        <a href="support@bricksensor.io" style="color: rgb(0, 83, 83); font-weight: 600; text-decoration: underline;">Service@24hrtruckfix.com</a>.
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
      path: path.join(__dirname, "../../assets/logo.png"), // Path to the logo file
      cid: "logo@24hrs", // Same as the cid used in the img tag
    },
  ],

  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Welcome email sent successfully");
  } catch (error) {
    console.error("Error sending welcome email:", error);
  }
};

module.exports = {
  sendWelcomeEmail,
};
