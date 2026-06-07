const Fee = require('../models/Fee');

exports.addFee = async (req, res) => {
  try {
    const receiptNo = 'REC-' + Date.now();
    const fee = await Fee.create({ ...req.body, receiptNo });
    res.status(201).json(fee);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.getStudentFees = async (req, res) => {
  try {
    const fees = await Fee.find({ studentId: req.params.studentId })
      .populate('studentId', 'name rollNumber class section')
      .sort({ createdAt: -1 });
    res.json(fees);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.updateFeeStatus = async (req, res) => {
  try {
    const update = { ...req.body };
    if (req.body.status === 'Paid') update.paidDate = new Date();
    const fee = await Fee.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!fee) return res.status(404).json({ error: 'Fee record not found' });
    res.json(fee);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.getPendingFees = async (req, res) => {
  try {
    const fees = await Fee.find({ status: { $in: ['Pending', 'Partial'] } })
      .populate('studentId', 'name rollNumber class section contact')
      .sort({ dueDate: 1 }).limit(20);
    res.json(fees);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getAllFees = async (req, res) => {
  try {
    const { status, feeType } = req.query;
    const filter = {};
    if (status)  filter.status  = status;
    if (feeType) filter.feeType = feeType;
    const fees = await Fee.find(filter)
      .populate('studentId', 'name rollNumber class section')
      .sort({ createdAt: -1 });
    res.json(fees);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getFeeStats = async (req, res) => {
  try {
    const paid = await Fee.aggregate([
      { $match: { status: 'Paid' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const pending = await Fee.aggregate([
      { $match: { status: { $in: ['Pending', 'Partial'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    
    res.json({ 
      collected: paid[0]?.total || 0, 
      pending: pending[0]?.total || 0 
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.deleteFee = async (req, res) => {
  try {
    const fee = await Fee.findByIdAndDelete(req.params.id);
    if (!fee) return res.status(404).json({ error: 'Fee record not found' });
    res.json({ message: 'Fee record deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.bulkGenerateFees = async (req, res) => {
  try {
    const { month, amount, type, dueDate, class: className } = req.body;
    const Student = require('../models/Student');
    
    const query = { status: 'Active' };
    if (className && className !== 'all') query.class = className;
    
    const students = await Student.find(query);
    let count = 0;

    for (const s of students) {
      // Duplicate check: Ek bache ki ek mahine ki same type ki fee do baar add na ho
      const exists = await Fee.findOne({ studentId: s._id, month, type });
      if (!exists) {
        await Fee.create({
          studentId: s._id, amount, month, type, dueDate,
          status: 'Pending',
          receiptNo: 'REC-' + Date.now() + Math.random().toString(36).substr(2, 4)
        });
        count++;
      }
    }
    res.json({ message: `${count} fee records generated successfully` });
  } catch (err) { res.status(400).json({ error: err.message }); }
};