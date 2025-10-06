// import axios from "axios";
// exports = async function (changeEvent) {
//   try {
//     console.log(
//       "*************************sendNewTicketTrigger****************************"
//     );
//     const { data } = await axios.post(
//       "https://kklayn.buildship.run/blandWebhook",
//       changeEvent,
//       {
//         headers: {
//           "Content-Type": "application/json",
//         },
//       }
//     );
//     console.log(data);
//     console.log(
//       "*************************endsendNewTicketTrigger****************************"
//     );
//     return data;
//   } catch (error) {
//     console.error("error sending data to API:", error);
//   }
// };

const axios = require("axios");
exports.sendNewTicketTrigger = async function (changeEvent) {
  try {
    console.log(
      "*************************sendNewTicketTrigger****************************"
    );
    const { data } = await axios.post(
      `${process.env.BUILDSHIP_BASE_URL}/blandWebhook`,
      changeEvent,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    console.log(data);
    console.log(
      "*************************endsendNewTicketTrigger****************************"
    );
    return data;
  } catch (error) {
    console.error("error sending data to API:", error);
    console.log(
      "*************************endsendNewTicketTrigger****************************"
    );
  }
};
