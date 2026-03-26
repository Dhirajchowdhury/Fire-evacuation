const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function updateZoneStatus(zoneId, status) {
  const { data, error } = await supabase
    .from('zones')
    .update({ status, last_updated: new Date().toISOString() })
    .eq('zone_id', zoneId);
  if (error) throw error;
  return data;
}

async function insertAlert(zoneId, status, message) {
  const { data, error } = await supabase
    .from('alerts')
    .insert({ zone_id: zoneId, status, message });
  if (error) throw error;
  return data;
}

async function getAllZones() {
  const { data, error } = await supabase
    .from('zones')
    .select('*')
    .order('zone_id');
  if (error) throw error;
  return data;
}

async function getRecentAlerts(limit = 20) {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

module.exports = { supabase, updateZoneStatus, insertAlert, getAllZones, getRecentAlerts };
