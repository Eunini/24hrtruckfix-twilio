const Ticket = require('../models/ticket.model');

// Generate a unique ticket number
exports.generateTicketNumber = async () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  
  // Get count of tickets for today
  const startOfDay = new Date(date.setHours(0, 0, 0, 0));
  const endOfDay = new Date(date.setHours(23, 59, 59, 999));
  
  const count = await Ticket.countDocuments({
    createdAt: {
      $gte: startOfDay,
      $lte: endOfDay
    }
  });
  
  // Format: TKT-YYMMDD-XXXX (where XXXX is a sequential number)
  const sequence = (count + 1).toString().padStart(4, '0');
  return `TKT-${year}${month}${day}-${sequence}`;
}; 