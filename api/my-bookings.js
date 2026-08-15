const { supabase } = require('../lib/supabase');
const { applyCors, requireAuth } = require('../lib/auth');

// GET  /api/my-bookings           -> all bookings linked to the logged-in user
// GET  /api/my-bookings?id=uuid   -> a single booking, only if it belongs to this user
// POST /api/my-bookings { action: 'claim', booking_ref }
//      -> links a guest booking to this account
//
// Booking ownership is determined by user_id, set automatically at booking
// time when the person was logged in (see api/bookings.js). Guest bookings
// (user_id null) won't show here until claimed.

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  const decoded = requireAuth(req, res);
  if (!decoded) return;

  if (req.method === 'GET') {
    const { id } = req.query || {};

    if (id) {
      const { data, error } = await supabase
        .from('camp_bookings')
        .select('*, prayer_camps(name, description, start_date, end_date, venue, cover_image_url)')
        .eq('id', id)
        .eq('user_id', decoded.id) // ownership check — never trust the id alone
        .maybeSingle();

      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'Booking not found.' });
      return res.status(200).json(data);
    }

    const { data, error } = await supabase
      .from('camp_bookings')
      .select('*, prayer_camps(name, description, start_date, end_date, venue, cover_image_url)')
      .eq('user_id', decoded.id)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { action, booking_ref } = req.body || {};
    if (action !== 'claim') {
      return res.status(400).json({ error: "action must be 'claim'." });
    }
    if (!booking_ref) {
      return res.status(400).json({ error: 'booking_ref is required.' });
    }

    // Links a guest booking (made before the person had an account, or
    // while logged out) to their account. Gated on the booking reference
    // (a shared secret only the booker has seen) plus a matching email —
    // not foolproof, but reasonable for a low-stakes claim like this.
    const { data: booking, error: findError } = await supabase
      .from('camp_bookings')
      .select('id, email, user_id')
      .eq('booking_ref', booking_ref.trim().toUpperCase())
      .maybeSingle();

    if (findError) return res.status(500).json({ error: findError.message });
    if (!booking) return res.status(404).json({ error: 'No booking found with that reference.' });

    if (booking.user_id && booking.user_id !== decoded.id) {
      return res.status(403).json({ error: 'This booking is already linked to a different account.' });
    }
    if (booking.email.toLowerCase() !== decoded.email.toLowerCase()) {
      return res.status(403).json({ error: 'This booking was made with a different email address.' });
    }

    const { data, error } = await supabase
      .from('camp_bookings')
      .update({ user_id: decoded.id })
      .eq('id', booking.id)
      .select('*, prayer_camps(name, start_date, end_date, venue)')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed.' });
};
