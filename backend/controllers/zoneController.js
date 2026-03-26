const { getAllZones } = require('../services/supabaseService');

async function getZones(req, res) {
  try {
    const zones = await getAllZones();
    return res.status(200).json(zones);
  } catch (err) {
    console.error('getZones error:', err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { getZones };
