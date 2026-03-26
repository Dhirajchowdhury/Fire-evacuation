require('dotenv').config();
const express = require('express');
const cors = require('cors');

const alertRoutes = require('./routes/alertRoutes');
const zoneRoutes = require('./routes/zoneRoutes');
const routeRoutes = require('./routes/routeRoutes');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use('/api/fire-alert', alertRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/evacuation-route', routeRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`🔥 FireRoute backend running on port ${PORT}`);
});
