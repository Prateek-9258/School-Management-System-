const express   = require('express');
const dotenv    = require('dotenv');
const cors      = require('cors');
const connectDB = require('./config/db');


dotenv.config();
connectDB();

const app = express();

app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

app.use('/api/auth',       require('./routes/auth'));
app.use('/api/students',   require('./routes/students'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/fees',       require('./routes/fees'));

app.get('/api/health', (req, res) =>
  res.json({ status: 'OK', message: 'School API running' })
);

app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

const PORT = process.env.PORT || 5005;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));