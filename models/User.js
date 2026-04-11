const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  email:       { type: String, required: true, unique: true },
  password:    { type: String, required: true },
  role:        { type: String, enum: ['admin', 'employee'], default: 'employee' },
  employeeId:  { type: String, unique: true, sparse: true },
  department:  { type: String, required: true, default: '' },
  phone:       { type: String, default: '' },
  dateOfBirth: { type: String, default: '' },
  bloodGroup:  { type: String, default: '' },
  fcmToken:    { type: String, default: '' },
  photoUrl:    { type: String, default: '' },
}, { timestamps: true });

// Auto-generate employeeId in format YYYYMMDDSerialNo e.g. 202501230001
userSchema.pre('save', async function (next) {
  if (this.role === 'employee' && !this.employeeId) {
    const dob = this.dateOfBirth ? new Date(this.dateOfBirth) : new Date();
    const yyyy = dob.getFullYear();
    const mm   = String(dob.getMonth() + 1).padStart(2, '0');
    const dd   = String(dob.getDate()).padStart(2, '0');
    const datePrefix = `${yyyy}${mm}${dd}`;

    const countSameDob = await mongoose.model('User').countDocuments({
      role: 'employee',
      employeeId: { $regex: `^${datePrefix}` },
    });
    const serial = String(countSameDob + 1).padStart(2, '0');
    this.employeeId = `${datePrefix}${serial}`;
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
