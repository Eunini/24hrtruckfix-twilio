const { User } = require('../models');
const { HTTP_STATUS_CODES } = require('../helper');

exports.updateIsAccepted = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findByIdAndUpdate(
      userId,
      { isAccepted: true },
      { new: true }
    );

    if (!user) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        message: 'User not found'
      });
    }

    res.status(HTTP_STATUS_CODES.OK).json({
      message: 'User acceptance updated successfully',
      user
    });
  } catch (error) {
    console.error('updateIsAccepted error:', error);
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      message: error.message
    });
  }
};
