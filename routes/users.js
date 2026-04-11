const router = require('express').Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const formatUser = (user) => ({
  uid: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  employeeId: user.employeeId ?? null,
  department: user.department,
  phone: user.phone,
  dateOfBirth: user.dateOfBirth,
  bloodGroup: user.bloodGroup,
  photoUrl: user.photoUrl,
  fcmToken: user.fcmToken,
});

// GET /users — all employees
router.get('/', async (req, res) => {
  try {
    const users = await User.find({ role: 'employee' });
    res.json(users.map(formatUser));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /users/:uid
router.get('/:uid', async (req, res) => {
  try {
    const user = await User.findById(req.params.uid);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(formatUser(user));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /users — admin creates employee
router.post('/', async (req, res) => {
  try {
    const { name, email, password, department, phone, dateOfBirth, bloodGroup } = req.body;
    if (!department) return res.status(400).json({ error: 'Department is required' });
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: 'Email already in use' });
    const pw = password || Math.random().toString(36).slice(-8);
    const hashed = await bcrypt.hash(pw, 10);
    const user = await User.create({
      name, email, password: hashed, role: 'employee',
      department, phone, dateOfBirth, bloodGroup,
    });
    res.json(formatUser(user));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /users/:uid/admin — admin updates employee
router.put('/:uid/admin', async (req, res) => {
  try {
    const fields = { ...req.body };
    if (fields.password) fields.password = await bcrypt.hash(fields.password, 10);
    delete fields.role;
    delete fields.employeeId;
    delete fields.designation;
    const user = await User.findByIdAndUpdate(
      req.params.uid, fields, { new: true, runValidators: false }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(formatUser(user));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /users/:uid/fcm-token
router.put('/:uid/fcm-token', async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.uid, { fcmToken: req.body.token });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /users/:uid — employee updates own profile
router.put('/:uid', async (req, res) => {
  try {
    const fields = { ...req.body };
    if (fields.password) fields.password = await bcrypt.hash(fields.password, 10);
    delete fields.role;
    delete fields.employeeId;
    delete fields.designation;
    const user = await User.findByIdAndUpdate(
      req.params.uid, fields, { new: true, runValidators: false }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(formatUser(user));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /users/:uid
router.delete('/:uid', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.uid);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
