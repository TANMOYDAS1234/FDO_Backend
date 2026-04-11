const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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

// POST /auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: 'Email already in use' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed, role: role ?? 'employee' });
    const token = jwt.sign({ uid: user._id, role: user.role }, process.env.JWT_SECRET);
    res.json({ ...formatUser(user), token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ uid: user._id, role: user.role }, process.env.JWT_SECRET);
    res.json({ ...formatUser(user), token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
