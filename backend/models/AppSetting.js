const mongoose = require('mongoose');

// Generic key/value store for admin-controlled, app-wide settings
// (e.g. which sports are hidden while they are out of season).
const appSettingSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  updatedBy: {
    type: String,
    trim: true,
    default: '',
  },
}, {
  timestamps: true,
  collection: 'app_settings',
});

module.exports = mongoose.model('AppSetting', appSettingSchema);
