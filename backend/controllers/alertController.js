const { updateZoneStatus, insertAlert, getAllZones } = require('../services/supabaseService');
const { findEvacuationPath } = require('../algorithms/evacuationEngine');

const VALID_ZONES = ['A', 'B', 'C', 'D'];
const VALID_STATUSES = ['fire', 'safe'];

async function handleFireAlert(req, res) {
  const { zone, status, device_id } = req.body;

  // Validate
  if (!VALID_ZONES.includes(zone)) {
    return res.status(400).json({ error: `Invalid zone. Must be one of: ${VALID_ZONES.join(', ')}` });
  }
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be "fire" or "safe"` });
  }

  console.log(`📡 Alert received: Zone ${zone} → ${status.toUpperCase()}${device_id ? ` (${device_id})` : ''}`);

  try {
    await updateZoneStatus(zone, status);

    const message =
      status === 'fire'
        ? `🔥 Fire detected in Zone ${zone}`
        : `✅ Zone ${zone} cleared`;

    await insertAlert(zone, status, message);

    const allZones = await getAllZones();
    const firedZones = allZones
      .filter((z) => z.status === 'fire')
      .map((z) => z.zone_id);

    const evacuationRoute = firedZones.length > 0
      ? findEvacuationPath(firedZones)
      : null;

    return res.status(200).json({
      success: true,
      zone,
      status,
      message,
      evacuationRoute,
    });
  } catch (err) {
    console.error('handleFireAlert error:', err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { handleFireAlert };
