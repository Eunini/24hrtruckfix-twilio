const AWS = require("aws-sdk");

AWS.config.update({
  region: "ap-south-1",
});

const S3 = new AWS.S3({ apiVersion: "2006-03-01" });

const formatS3Data = async (bucket, bucketKey) => {
  console.log("formatS3Data", {bucket, bucketKey});
  let result = [];
  try {
    const data = await S3.getObject({
      Bucket: bucket,
      Key: bucketKey,
    }).promise();

    console.log("s3 response", data?.Body?.toString("utf-8"));
    console.info("\n Response Data: \n");
    result = data?.Body?.toString("utf-8");
  } catch (error) {
    console.info("Error occured", error);
    //Logging exception
    result = [];
  }
  return result;
};

module.exports = {
  formatS3Data
}