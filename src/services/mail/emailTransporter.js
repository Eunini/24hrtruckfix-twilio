require('dotenv').config();
const nodemailer = require('nodemailer');

// Using environment variables for configuration
// const transporter = nodemailer.createTransport({
//   host: process.env.ADMIN_EMAIL_HOST  , // Default to Gmail SMTP
//   port: process.env.ADMIN_EMAIL_PORT  , // Default to port 25
//   secure: false,
//   auth: {
//     user: process.env.ADMIN_EMAIL_AUTH_USER  ,
//     pass: process.env.ADMIN_EMAIL_AUTH_PASS ,
//   },
// });

 
// Original in-file variables for reference:
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', 
  port: 465, 
  secure: true,
  auth: {
    user: process.env.FROM_EMAIL,
    pass: process.env.EMAIL_PASS
  }
});


module.exports = transporter;
