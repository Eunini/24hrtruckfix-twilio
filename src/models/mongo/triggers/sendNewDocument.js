const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

exports.sendNewDocumenttrigger = async function (payload) {
  try {
    console.log(
      "*************************sendNewDocumenttrigger****************************"
    );
    console.log("payload", payload);

    if (!payload || !payload.client_id || !payload.file1 || !payload.fileName) {
      throw new Error("Invalid payload. Missing client_id, file1, or fileName.");
    }

    const formdata = new FormData();
    formdata.append("client_id", payload.client_id);
    const fileBuffer = Buffer.from(payload.file1, "base64");

    const isLambda = process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;
    const uploadDir = isLambda
      ? "/tmp/uploads" 
      : path.join(__dirname, "uploads");

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const tempFilePath = path.join(uploadDir, payload.fileName);

    fs.writeFileSync(tempFilePath, fileBuffer);

    formdata.append("file1", fs.createReadStream(tempFilePath), {
      filename: payload.fileName,
      contentType: "application/octet-stream",
    });

    const { data } = await axios.post(
      `${process.env.BUILDSHIP_BASE_URL}/upload-docs-to-vapi`,
      formdata,
      {
        headers: formdata.getHeaders(),
      }
    );

    console.log("API Response:", data);

    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    console.log(
      "*************************endNewDocumenttrigger****************************"
    );
    return data; 
  } catch (error) {
    console.error("Error sending data to API:", error.message);
    console.log(
      "*************************error sendNewDocumenttrigger****************************"
    );
    throw error;
  }
};
