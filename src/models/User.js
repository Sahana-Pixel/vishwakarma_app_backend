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
  password: {
    type: String,
  },
  securityQuestion: {
    type: String,
  },
  securityAnswer: {
    type: String,
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
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: false
    },
    coordinates: {
      type: [Number],
      required: false
    }
  },
  locationName: {
    type: String,
    default: null
  },
  locationSource: {
    type: String,
    enum: ['gps', 'manual'],
    default: null
  },
  isLocationVisible: {
    type: Boolean,
    default: true
  },
  professionDescription: {
    type: String,
    maxLength: 1000,
    default: null
  },
  workImages: {
    type: [{
      url: String,
      publicId: String,
      uploadedAt: {
        type: Date,
        default: Date.now
      },
      order: {
        type: Number,
        required: true
      },
      isPrimary: {
        type: Boolean,
        default: false
      }
    }],
    default: []
  },
  contributionOptions: {
    type: [String],
    default: []
  },
  contributionDescription: {
    type: String,
    default: null
  },
  contributionSubmittedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for geospatial queries
userSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('User', userSchema);
