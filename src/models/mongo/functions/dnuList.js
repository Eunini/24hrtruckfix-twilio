const { getMongoConnection } = require('../../../loaders/mongo/connect');
const DnuListModel = require('../models/dnuList');
const DnuCsvUploadModel = require('../models/dnuCsvUploadStatus');

exports.getAllDnuListDatas = async (
  page = 1,
  limit = 10,
  search = '',
  sortField = 'createdAt',
  sort = -1,
  user
) => {
  const query = { clientId: user.userId }; 

  if (search.trim() !== '') {
    const searchTerms = search
      .split(' ')
      .filter((term) => term.trim().length > 0);

    query.$and = searchTerms.map((term) => ({
      $or: [
        { facilityEmail: { $regex: term, $options: 'i' } },
        { facilityPhoneNumber: { $regex: term, $options: 'i' } },
        { facilityName: { $regex: term, $options: 'i' } },
        { facilityAddress: { $regex: term, $options: 'i' } },
        { dnuReason: { $regex: term, $options: 'i' } },
        { notes: { $regex: term, $options: 'i' } },
      ],
    }));
  }

  const options = {
    page,
    limit,
    sort: { [sortField]: Number(sort) },
  };

  let dnuList = null;
  try {
    await getMongoConnection();
    dnuList = await DnuListModel.paginate(query, options);
    const totaldnuListCount = await DnuListModel.countDocuments(query);
    return { dnuList, totaldnuListCount };
  } catch (ex) {
    console.error('exception getTickets', ex);
  }
  return dnuList;
};

exports.deleteDNU = async (dnuId) => {
  try {
    await getMongoConnection();

    const dnuList = await DnuListModel.findOne({ _id: dnuId });
    if (!dnuList) {
      throw new Error(`User with ID ${dnuId} not found`);
    }

    await DnuListModel.deleteOne({ _id: dnuId });
    return dnuList;
  } catch (ex) {
    console.error('Exception in deleteUser:', ex);
    throw new Error('Error in deleting user: ' + ex.message);
  }
};

exports.recentDnuList = async (user) => {
  let uploadedDnuList = null;
  try {
    await getMongoConnection();
    uploadedDnuList = await DnuCsvUploadModel.find({ client_id: user.userId })
      .sort({ _id: -1 })
      .limit(1);
    console.log('recentDnuList', uploadedDnuList);
    return uploadedDnuList;
  } catch (ex) {
    console.error('exception recentDnuList', ex);
  }

  return uploadedDnuList;
};
