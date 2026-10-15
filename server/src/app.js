const express = require('express');
const cors = require('cors');
const payrollRoutes = require('./routes/payrollRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const nlqRoutes = require('./routes/nlqRoutes');
const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/payroll', payrollRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/nlq', nlqRoutes);


app.get('/', (req, res) => {
    res.json({ message: 'Vizura API running' });
});

module.exports = app;