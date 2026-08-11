/* Stub — Step 8 "Customer History" (search by mobile number: previous
   bills, total spend, visit count, favourite items). Not built yet. */
function getCustomerHistory(req, res) {
  res.status(501).json({ error: 'Customer history isn\'t built yet — planned for a future step.' });
}

module.exports = { getCustomerHistory };
