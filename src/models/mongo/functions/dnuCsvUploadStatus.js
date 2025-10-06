const { getMongoConnection } = require('../../../loaders/mongo/connect');
const { SUCCESS, FAILED } = require('../enums/policiesDocUploadStatus');
const DnuCsvUploadModel = require('../models/dnuCsvUploadStatus');
exports.saveDnuCsvUploadStatus = async (s3Object) => {
  console.log(
    'saveDnuCsvUploadStatus to be inserted in DB',
    JSON.stringify(s3Object)
  );
  let insertedPolicy = null;
  console.log(JSON.stringify(DnuCsvUploadModel));
  try {
    await getMongoConnection();
    insertedPolicy = await DnuCsvUploadModel.create({
      file_upload_status: SUCCESS,
      file_key: s3Object?.object?.key,
      file_size: s3Object?.object?.size,
      file_eTag: s3Object?.object?.eTag,
    });

    return insertedPolicy;
  } catch (ex) {
    console.error('exception saveDnuCsvUploadStatus', ex);
    insertedPolicy = await DnuCsvUploadModel.create({
      file_upload_status: FAILED,
      file_key: s3Object?.object?.key,
      file_size: s3Object?.object?.size,
      file_eTag: s3Object?.object?.eTag,
    });
  }
  return insertedPolicy;
};

exports.saveDnuCsvProgress = async (
  fileKey,
  fileEtag,
  status,
  reason,
  fileSize,
  clientId
) => {
  console.log('saveDnuCsvProgress to be inserted in DB', {
    fileKey,
    fileEtag,
    status,
    reason,
    fileSize,
    clientId
  });
  let updatedProgress = null;
  try {
    if (status === SUCCESS && !reason) {
      reason = 'Upload URL generated successfully';
    }

    await getMongoConnection();
    updatedProgress = await DnuCsvUploadModel.updateOne(
      { file_key: fileKey },
      {
        $set: {
          file_data_sync_status: status,
          file_eTag: fileEtag,
          failure_reason: reason,
          file_size: fileSize,
          client_id: clientId,
        },
      },
      { upsert: true }
    );
    return updatedProgress;
  } catch (ex) {
    // Wrap fields with `$set` in catch block as well
    updatedProgress = await DnuCsvUploadModel.updateOne(
      { file_key: fileKey },
      {
        $set: {
          file_data_sync_status: status,
          file_eTag: fileEtag,
          failure_reason: reason,
          file_size: fileSize,
          client_id: clientId,
        },
      },
      { upsert: true }
    );
  }
  return updatedProgress;
};

exports.getUploadedDnuCsvFileList = async () => {
  let uploadedDnuCsvList = null;
  try {
    await getMongoConnection();
    uploadedDnuCsvList = await DnuCsvUploadModel.find()
      .sort({ _id: -1 })
      .limit(1);
    console.log('uploadedDnuCsvList', uploadedDnuCsvList);
    return uploadedDnuCsvList;
  } catch (ex) {
    console.error('exception getUploadedDnuCsvFileList', ex);
  }

  return uploadedDnuCsvList;
};
