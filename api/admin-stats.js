const { supabase } = require('../lib/supabase');
const { applyCors, requireAdmin } = require('../lib/auth');

// GET /api/admin-stats -> aggregate counts for the admin dashboard overview
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const admin = requireAdmin(req, res);
  if (!admin) return;

  const [
    totalBookingsRes,
    pendingBookingsRes,
    approvedBookingsRes,
    upcomingCampsRes,
    recentBookingsRes,
    totalUsersRes,
  ] = await Promise.all([
    supabase.from('camp_bookings').select('id', { count: 'exact', head: true }),
    supabase.from('camp_bookings').select('id', { count: 'exact', head: true }).eq('status', 'Pending'),
    supabase.from('camp_bookings').select('id', { count: 'exact', head: true }).eq('status', 'Approved'),
    supabase.from('camp_availability').select('*').gte('end_date', new Date().toISOString().slice(0, 10)).order('start_date', { ascending: true }),
    supabase.from('camp_bookings').select('id, booking_ref, full_name, status, created_at, prayer_camps(name)').order('created_at', { ascending: false }).limit(8),
    supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'user'),
  ]);

  const firstError = [totalBookingsRes, pendingBookingsRes, approvedBookingsRes, upcomingCampsRes, recentBookingsRes, totalUsersRes]
    .find(r => r.error);
  if (firstError) return res.status(500).json({ error: firstError.error.message });

  return res.status(200).json({
    total_bookings: totalBookingsRes.count || 0,
    pending_bookings: pendingBookingsRes.count || 0,
    approved_bookings: approvedBookingsRes.count || 0,
    total_users: totalUsersRes.count || 0,
    upcoming_camps: upcomingCampsRes.data || [],
    recent_bookings: recentBookingsRes.data || [],
  });
};
