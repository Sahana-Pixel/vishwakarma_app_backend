/**
 * User Model
 * Stores user information
 */

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  // Personal Details
  gender: String,
  aadhaar: String,
  fatherName: String,
  motherName: String,
  relationshipWithHead: String,
  gothra: String,
  dateOfBirth: Date,
  // Education & Family
  education: String,
  upanayana: Boolean,
  maritalStatus: String,
  numberOfChildren: Number,
  // Employment & Income
  occupation: String,
  occupationDetails: String,
  annualIncome: String,
  taxPayer: Boolean,
  // House & Contact
  houseType: String,
  residenceAddress: String,
  familyHouse: String,
  rationCardType: String,
  specialPerson: Boolean,
  profileImage: String,
  // Metadata
  isProfileComplete: {
    type: Boolean,
    default: false
  },
  joinedDate: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for phone number lookups
userSchema.index({ phone: 1 });

module.exports = mongoose.model('User', userSchema);
