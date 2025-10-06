const { KeyContact } = require('../models');

exports.createKeyContact = async (contactData) => {
  try {
    const newKeyContact = new KeyContact({
      billingContacts: {
        name: contactData.username,
        phone: contactData.phone,
        email: contactData.email,
        companyName: contactData.companyName,
        amount: contactData.amount,
        paymentTerms: contactData.paymentTerms,
        address: contactData.address,
        taxId: contactData.taxId,
      },
      emergencyApproval: {
        jobTitle: contactData.emergencyApprovalJobtitle,
        name: contactData.emergencyApprovalName,
        phone: contactData.emergencyApprovalPhone,
        email: contactData.emergencyApprovalEmail,
      },
      signators: {
        name: contactData.signatorsName,
        email: contactData.signatorsEmail,
        phone: contactData.signatorsPhone,
        authorizationCode: contactData.signatorsAuthorizationCode,
      },
      clientId: contactData.clientId,
    });

    const savedKeyContact = await newKeyContact.save();
    return savedKeyContact;
  } catch (error) {
    throw new Error(`Error creating key contact: ${error.message}`);
  }
};

exports.getKeyContacts = async () => {
  try {
    const keyContacts = await KeyContact.find();
    return keyContacts;
  } catch (error) {
    throw new Error(`Error retrieving key contacts: ${error.message}`);
  }
}; 