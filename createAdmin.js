/**
 * Admin Creation Script
 * Usage: node createAdmin.js <name> <email> <password>
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const Admin = require('./src/models/Admin');

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('✗ Error: MONGODB_URI is not defined in the backend .env file.');
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('Usage: node createAdmin.js <name> <email> <password>');
  process.exit(1);
}

const [name, email, password] = args;

const createAdmin = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Check for duplicate admin email
    const existingAdmin = await Admin.findOne({ email: email.toLowerCase().trim() });
    if (existingAdmin) {
      console.error(`✗ Error: Admin with email '${email}' already exists.`);
      await mongoose.disconnect();
      process.exit(1);
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create admin
    const admin = new Admin({
      name,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: 'admin',
      isActive: true
    });

    await admin.save();
    console.log(`✓ Admin successfully created: ${admin.name} (${admin.email})`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('✗ Failed to create admin:', error.message);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
};

createAdmin();
