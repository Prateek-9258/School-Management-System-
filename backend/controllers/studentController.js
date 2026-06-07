const Student = require('../models/Student');

exports.addStudent = async (req, res) => {
  try {
    const student = await Student.create(req.body);
    res.status(201).json(student);
  } catch (err) {
    console.error('ADD STUDENT ERROR:', err.message);
    if (err.code === 11000) {
      return res.status(400).json({
        error: `Roll Number ${req.body.rollNumber} already exists in Class ${req.body.class}`
      });
    }
    res.status(400).json({ error: err.message });
  }
};

exports.getAllStudents = async (req, res) => {
  try {
    const { class: cls, section, status, search } = req.query;
    const filter = {};
    if (cls)     filter.class   = cls;
    if (section) filter.section = section;
    if (status)  filter.status  = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { class: { $regex: search, $options: 'i' } },
        { rollNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const students = await Student.find(filter);

    // ✅ Natural sort: 1,2,3...10,11 instead of 1,10,11,2,3
    students.sort((a, b) => {
      // Sort by class first (numerically)
      const classA = parseInt(a.class) || 0;
      const classB = parseInt(b.class) || 0;
      if (classA !== classB) return classA - classB;

      // Then sort by section
      if (a.section < b.section) return -1;
      if (a.section > b.section) return 1;

      // Then sort roll number naturally (1,2,3...10,11,12)
      const rollA = a.rollNumber.toString();
      const rollB = b.rollNumber.toString();
      return rollA.localeCompare(rollB, undefined, { numeric: true, sensitivity: 'base' });
    });

    res.json(students);
  } catch (err) {
    console.error('GET STUDENTS ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.getStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (err) {
    console.error('GET STUDENT ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(
      req.params.id, req.body, { new: true, runValidators: true }
    );
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (err) {
    console.error('UPDATE STUDENT ERROR:', err.message);
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Roll Number already exists in that class' });
    }
    res.status(400).json({ error: err.message });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json({ message: 'Student deleted successfully' });
  } catch (err) {
    console.error('DELETE STUDENT ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.getStats = async (req, res) => {
  try {
    const total   = await Student.countDocuments();
    const active  = await Student.countDocuments({ status: 'Active' });
    const byClass = await Student.aggregate([
      { $group: { _id: '$class', count: { $sum: 1 } } },
      { $sort:  { _id: 1 } }
    ]);
    res.json({ total, active, inactive: total - active, byClass });
  } catch (err) {
    console.error('GET STATS ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
};
