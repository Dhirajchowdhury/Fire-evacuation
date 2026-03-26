const supabase = require('./supabaseService');

// TODO: Subscribe to zones table changes and broadcast to connected clients

function subscribeToZones(callback) {
  // TODO: implement Supabase realtime subscription on zones table
  supabase
    .channel('zones')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'zones' }, callback)
    .subscribe();
}

module.exports = { subscribeToZones };
