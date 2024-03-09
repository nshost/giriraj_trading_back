const express = require('express');
const bodyParser = require('body-parser');
const { check, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// MongoDB connection
const dbUri = 'mongodb+srv://umar:0000@cluster0.k5o4qzt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'; // replace with your MongoDB connection URI

// Check if the connection is already established
if (!mongoose.connection.readyState) {
  mongoose.connect(dbUri, { useNewUrlParser: true, useUnifiedTopology: true });

  const db = mongoose.connection;
  db.on('error', console.error.bind(console, 'MongoDB connection error:'));
  db.once('open', () => {
    console.log('Connected to MongoDB');
  });
}

// MongoDB schema
const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  companyName: String,
  gstNumber: String,
  password: String,
});

const UserModel = mongoose.model('User', userSchema);

// Nodemailer setup (replace with your own SMTP settings)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'your_email@gmail.com',
    pass: 'your_password',
  },
});

// Middleware for validating signup fields
const validateSignupFields = [
  check('name').isLength({ min: 3 }).withMessage('Name must be at least 3 characters'),
  check('email').isEmail().withMessage('Invalid email address'),
  check('companyName').isLength({ min: 3 }).withMessage('Company name must be at least 3 characters'),
  check('gstNumber').isLength({ min: 3 }).withMessage('GST number must be at least 3 characters'),
  check('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  check('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  }),
];

// Signup route
app.post('/signup', validateSignupFields, async (req, res) => {
    const errors = validationResult(req);
  
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
  
    const { name, email, companyName, gstNumber, password } = req.body;
  
    // Check if user already exists
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }
  
    // Create a new user
    const newUser = new UserModel({ name, email, companyName, gstNumber, password });
    await newUser.save();
  
    // Generate and return a JWT token
    const token = jwt.sign({ userId: newUser._id }, 'nsmedia'); // Replace 'your-secret-key' with a secure secret key
    res.status(201).json({ message: 'Signup successful', token });
  });
  

// Signin route with JWT authentication
app.post('/signin', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if user exists and password is correct
    const user = await UserModel.findOne({ email, password });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate and return a JWT token
    const token = jwt.sign({ userId: user._id }, 'nsmedia'); // Replace 'your-secret-key' with a secure secret key
    res.json({ message: 'Signin successful', token });
  } catch (error) {
    console.error('Error during signin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route for sending final quotes via email with token authentication
app.post('/sendQuotes', authenticateToken, (req, res) => {
  const { email, quotes } = req.body;

  // Create email body
  const mailOptions = {
    from: 'your_email@gmail.com',
    to: email,
    subject: 'Your Final Quotes',
    text: `Here are your final quotes: ${quotes.join(', ')}`,
  };

  // Send email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return res.status(500).json({ error: 'Error sending email' });
    }
    res.json({ message: 'Quotes sent successfully' });
  });
});

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const token = req.header('Authorization');

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  jwt.verify(token, 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Forbidden: Invalid token' });
    }
    req.user = user;
    next();
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app; // Export the app for testing
