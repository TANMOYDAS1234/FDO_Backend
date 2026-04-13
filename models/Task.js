const mongoose = require('mongoose');

const taskUpdateSchema = new mongoose.Schema({
  note:   { type: String, required: true },
  status: { type: String, enum: ['pending', 'in_progress', 'completed'], required: true },
  date:   { type: Date, default: Date.now },
}, { _id: false });

const taskSchema = new mongoose.Schema({
  title:       { type: String, required: true },
  description: { type: String, required: true },
  assignedTo:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status:      { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
  dueDate:     { type: Date, required: true },
  updates:     { type: [taskUpdateSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('Task', taskSchema);
