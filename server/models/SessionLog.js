const mongoose = require('mongoose');

const sessionLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  loginAt: { type: Date, required: true },
  logoutAt: { type: Date },
  durationMs: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('SessionLog', sessionLogSchema);