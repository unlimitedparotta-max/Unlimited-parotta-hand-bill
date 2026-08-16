require('dotenv').config();
const express = require('express');
const path = require('path');
const { UPLOAD_DIR } = require('./utils/constants');
const { errorHandler } = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const authRoutes = require('./routes/authRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');
const smsRoutes = require('./routes/smsRoutes');
const emailRoutes = require('./routes/emailRoutes');
const customerRoutes = require('./routes/customerRoutes');
const reportRoutes = require('./routes/reportRoutes');
const dayClosingRoutes = require('./routes/dayClosingRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const staffRoutes = require('./routes/staffRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, 'public')));

// Auth routes are mounted under /api/*
app.use('/api', authRoutes);
// The rest already define their own full paths (some are /api/*, some are
// customer-facing pages like /bill/:code and /pay/:billNo).
app.use('/', orderRoutes);
app.use('/', paymentRoutes);
app.use('/', whatsappRoutes);
app.use('/', smsRoutes);
app.use('/', emailRoutes);
app.use('/', customerRoutes);
app.use('/', reportRoutes);
app.use('/', dayClosingRoutes);
app.use('/', inventoryRoutes);
app.use('/api/staff', staffRoutes);

app.get('/health', (req, res) => res.send('ok'));

app.use(errorHandler);

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    logger.info('Unlimited Parotta billing running on port ' + PORT);
  });
}

module.exports = app;
