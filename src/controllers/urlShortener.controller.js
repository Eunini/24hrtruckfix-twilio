const UrlForDriver = require("../models/urlForDriver.model");
const Organization = require("../models/organization.model");
const Onboarding = require("../models/onboarding.model");
const User = require("../models/user.model");
const AiConfig = require("../models/ai-config.model");

/**
 * Redirect to URL with company details
 * @route GET /dev/urlShortner/:linkId
 */
exports.redirectToUrl = async (req, res) => {
  try {
    const { linkId } = req.params;

    if (!linkId) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Error</title>
        </head>
        <body>
            <h1>Invalid Link</h1>
            <p>The link ID is missing or invalid.</p>
        </body>
        </html>
      `);
    }

    // STEP 1: Find the URL document
    const urlDoc = await UrlForDriver.findOne({ link_id: linkId });
    if (!urlDoc) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Link Not Found</title>
        </head>
        <body>
            <h1>Link Not Found</h1>
            <p>The requested link could not be found.</p>
        </body>
        </html>
      `);
    }

    // STEP 2: Get organization data
    const organization = await Organization.findById(urlDoc.org_id);
    if (!organization) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Organization Not Found</title>
        </head>
        <body>
            <h1>Organization Not Found</h1>
            <p>The organization associated with this link could not be found.</p>
        </body>
        </html>
      `);
    }

    // STEP 3: Get onboarding data
    const onboarding = await Onboarding.findOne({
      user_id: organization.owner,
    });

    // STEP 4: Get user data
    const user = await User.findById(organization.owner);

    // STEP 5: Get AI config for phone number
    const aiConfig = await AiConfig.findOne({
      organization_id: organization._id,
    });

    // STEP 6: Extract and format data with fallbacks
    const actualLink =
      urlDoc.link || "https://roadrescue24hr.fillout.com/driverloc";

    const companyWebsite =
      onboarding?.companyDetails?.companyWebsite || "24hrtruckservices.com";
    const userEmail = user?.email || "concierge@24hrtruckfix.com";
    const companyName =
      onboarding?.companyDetails?.companyName || "24Hr Truck Services";
    const officialAddress =
      onboarding?.companyDetails?.officialAddress ||
      "300 Delaware Ave. Suite 210";
    const incorporatedIn =
      onboarding?.companyDetails?.incorporatedIn || "Wilmington DE 19801";

    // Format phone number
    let formattedPhone = "1302-273-1234";
    if (aiConfig?.number) {
      const cleanPhone = aiConfig.number.replace(/[^0-9]/g, ""); // Remove all non-digits
      // Format as XXX-XXX-XXXX for 10 digits or XXXX-XXX-XXXX for 11 digits
      if (cleanPhone.length === 10) {
        formattedPhone = cleanPhone.replace(
          /(\d{3})(\d{3})(\d{4})/,
          "$1-$2-$3"
        );
      } else if (cleanPhone.length === 11) {
        formattedPhone = cleanPhone.replace(
          /(\d{4})(\d{3})(\d{4})/,
          "$1-$2-$3"
        );
      } else if (cleanPhone.length > 11) {
        // For longer numbers, take last 11 digits
        const last11 = cleanPhone.slice(-11);
        formattedPhone = last11.replace(/(\d{4})(\d{3})(\d{4})/, "$1-$2-$3");
      } else if (cleanPhone.length > 0) {
        // For shorter numbers, just use what we have
        formattedPhone = cleanPhone;
      }
    }

    // STEP 7: Build redirect URL with parameters
    const redirectUrl = `${actualLink}&website=${encodeURIComponent(
      companyWebsite
    )}&cli_email=${encodeURIComponent(userEmail)}&cli_name=${encodeURIComponent(
      companyName
    )}&cli_address1=${encodeURIComponent(
      officialAddress
    )}&cli_address2=${encodeURIComponent(
      incorporatedIn
    )}&cli_phone=${encodeURIComponent(formattedPhone)}`;

    // STEP 8: Return HTML with redirect
    const htmlResponse = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="refresh" content="0; url=${redirectUrl}">
    <title>Redirecting...</title>
</head>
<body>
    <p>If you are not redirected automatically, <a href="${redirectUrl}">click here</a>.</p>
</body>
</html>`;

    console.log(`🔗 URL shortener redirect for linkId: ${linkId}`);
    console.log(`📍 Redirecting to: ${redirectUrl}`);

    res.set("Content-Type", "text/html");
    res.send(htmlResponse);
  } catch (error) {
    console.error("❌ Error in URL shortener redirect:", error);

    res.status(500).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Server Error</title>
      </head>
      <body>
          <h1>Server Error</h1>
          <p>An error occurred while processing your request. Please try again later.</p>
      </body>
      </html>
    `);
  }
};
