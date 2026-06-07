const Attendance = require('../models/Attendance');
const mongoose   = require('mongoose');

exports.markAttendance = async (req, res) => {
  try {
    const record = await Attendance.create({ ...req.body, markedBy: req.user._id });
    res.status(201).json(record);
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.markBulkAttendance = async (req, res) => {
  try {
    const { records } = req.body;
    const ops = records.map(r => ({
      updateOne: {
        filter: { student: r.student, date: new Date(r.date) },
        update: { $set: { ...r, markedBy: req.user._id } },
        upsert: true
      }
    }));
    await Attendance.bulkWrite(ops);
    res.json({ message: `${records.length} attendance records saved` });
  } catch (err) { res.status(400).json({ error: err.message }); }
};

exports.getAttendanceByDate = async (req, res) => {
  try {
    const date = new Date(req.params.date);
    const next = new Date(date); next.setDate(date.getDate() + 1);
    const records = await Attendance.find({ date: { $gte: date, $lt: next }, section: 'A' })
      .populate('student', 'name rollNumber class section');
    res.json(records);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getStudentAttendance = async (req, res) => {
  try {
    const records = await Attendance
      .find({ student: req.params.studentId })
      .sort({ date: -1 });
    res.json(records);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getAttendanceSummary = async (req, res) => {
  try {
    const summary = await Attendance.aggregate([
      { $match: { student: new mongoose.Types.ObjectId(req.params.studentId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    res.json(summary);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

exports.getTodayStats = async (req, res) => {
  try {
    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
    const stats = await Attendance.aggregate([
      { $match: { date: { $gte: today, $lt: tomorrow }, section: 'A' } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    res.json(stats);
  } catch (err) { res.status(500).json({ error: err.message }); }
};