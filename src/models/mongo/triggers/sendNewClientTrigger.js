const axios = require("axios");
exports.sendNewClientrigger = async function (changeEvent) {
  try {
    console.log(
      "*************************sendNewClientrigger****************************"
    );

    console.log(changeEvent, 'changeEvent');
    const { data } = await axios.post(
       `${process.env.BUILDSHIP_BASE_URL}/configure-client`,
       changeEvent,
       {
         headers: {
           "Content-Type": "application/json",
         },
       }
     );
    console.log(data);
    console.log(
      "*************************sendNewClientrigger****************************"
    );
    return 1;
  } catch (error) {
    console.error("error sending data to API:", error);
    console.log(
      "*************************sendNewClientrigger****************************"
    );
  }
};
