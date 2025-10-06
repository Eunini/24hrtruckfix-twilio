const { getMongoConnection } = require('../../../loaders/mongo/connect');
const { SUCCESS, FAILED } = require('../enums/policiesDocUploadStatus');
const FleetDocUploadModel = require('../models/fleetDocUploadStatus');
const MechanicsDocUploadModel = require('../models/mechanicDocUploadStatus');
const PoliciesDocUploadModel = require('../models/policiesDocUploadStatus');
exports.savePoliciesDocUploadStatus = async (s3Object) => {
  console.log(
    'savePoliciesDocUploadStatus to be inserted in DB',
    JSON.stringify(s3Object)
  );
  let insertedPolicy = null;
  console.log(JSON.stringify(PoliciesDocUploadModel));
  try {
    await getMongoConnection();
    insertedPolicy = await PoliciesDocUploadModel.create({
      file_upload_status: SUCCESS,
      file_key: s3Object?.object?.key,
      file_size: s3Object?.object?.size,
      file_eTag: s3Object?.object?.eTag,
    });

    return insertedPolicy;
  } catch (ex) {
    console.error('exception savePoliciesDocUploadStatus', ex);
    insertedPolicy = await PoliciesDocUploadModel.create({
      file_upload_status: FAILED,
      file_key: s3Object?.object?.key,
      file_size: s3Object?.object?.size,
      file_eTag: s3Object?.object?.eTag,
    });
  }
  return insertedPolicy;
};
exports.savePolicyDocProgress = async (
  fileKey,
  pending,
  status,
  fileEtag,
  reason,
  fileSize,
  type
) => {
  console.log('savePolicyDocProgress to be inserted in DB', {
    fileKey,
    pending,
    status,
    fileEtag,
    reason,
    fileSize,
    type,
  });

  let updatedProgress = null;
  let model;
  if (type === 'client') {
    model = PoliciesDocUploadModel;
  } else if (type === 'fleet') {
    model = FleetDocUploadModel;
  } else if (type === 'spuploads') {
    model = MechanicsDocUploadModel;
  } 

  try {
    if (status === SUCCESS && !reason) {
      reason = 'Upload URL generated successfully';
    }

    await getMongoConnection();

    updatedProgress = await model.updateOne(
      { file_key: fileKey },
      {
        $set: {
          file_data_sync_status: status,
          file_eTag: fileEtag,
          failure_reason: reason,
          file_size: fileSize,
          file_upload_status: pending,
        },
      },
      { upsert: true }
    );
  } catch (error) {
    console.error('Error saving policy document progress:', error.message);

    try {
      updatedProgress = await model.updateOne(
        { file_key: fileKey },
        {
          $set: {
            file_data_sync_status: status,
            file_eTag: fileEtag,
            failure_reason: reason,
            file_size: fileSize,
            file_upload_status: pending,
          },
        },
        { upsert: true }
      );
    } catch (retryError) {
      console.error('Retry failed while saving policy document progress:', retryError.message);
      throw retryError; // Rethrow to propagate error further
    }
  }

  return updatedProgress;
};

exports.getUploadedFileList = async () => {
  let uploadedPolicyList = null;
  try {
    await getMongoConnection();
    uploadedPolicyList = await PoliciesDocUploadModel.find()
      .sort({ _id: -1 })
      .limit(1);
    console.log('uploadedPolicyList', uploadedPolicyList);
    return uploadedPolicyList;
  } catch (ex) {
    console.error('exception getUploadedFileList', ex);
  }

  return uploadedPolicyList;
};
