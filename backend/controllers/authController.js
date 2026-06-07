const User = require('../models/User');
const jwt  = require('jsonwebtoken');

const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });

exports.register = async (req, res) => {
  try {
    const { name, username, email, password, role, mobile } = req.body;
    if (await User.findOne({ email }))
      return res.status(400).json({ error: 'Email already exists' });
    const user = await User.create({ name, username, email, password, role, mobile });
    res.status(201).json({
      _id: user._id, name: user.name, username: user.username,
      email: user.email, role: user.role,
      token: generateToken(user._id, user.role)
    });
  } catch (err) {
    console.error('REGISTER ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    console.log('LOGIN ATTEMPT → username:', username, '| email:', email);

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Find user by username OR email
    let user = null;

    if (username && username.trim()) {
      user = await User.findOne({ username: username.trim() });
      console.log('Find by username:', user ? 'FOUND' : 'NOT FOUND');
    }

    if (!user && email && email.trim()) {
      user = await User.findOne({ email: email.toLowerCase().trim() });
      console.log('Find by email:', user ? 'FOUND' : 'NOT FOUND');
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isMatch = await user.matchPassword(password);
    console.log('Password match:', isMatch);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    res.json({
      _id:      user._id,
      name:     user.name,
      username: user.username,
      email:    user.email,
      role:     user.role,
      token:    generateToken(user._id, user.role)
    });

  } catch (err) {
    console.error('LOGIN ERROR:', err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    res.json(req.user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
