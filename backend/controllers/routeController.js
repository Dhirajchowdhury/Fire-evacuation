const { getAllZones } = require('../services/supabaseService');
const { findEvacuationPath } = require('../algorithms/evacuationEngine');

async function getEvacuationRoute(req, res) {
  try {
    const zones = await getAllZones();
    const firedZones = zones
      .filter((z) => z.status === 'fire')
      .map((z) => z.zone_id);

    const route = firedZones.length > 0
      ? findEvacuationPath(firedZones)
      : null;

    return res.status(200).json({ route });
  } catch (err) {
    console.error('getEvacuationRoute error:', err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { getEvacuationRoute };
