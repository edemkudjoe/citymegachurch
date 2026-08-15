const { supabase } = require('../lib/supabase');
const { applyCors, requireAdmin, requireAuth, verifyToken, getTokenFromRequest } = require('../lib/auth');

// GET    /api/bookings?ref=CMC-2026-0001        -> public lookup by booking ref (for confirmation page)
// GET    /api/bookings                          -> admin: list all (supports ?status=&camp_id=&search=)
// GET    /api/bookings?id=uuid                  -> admin: single booking by id
// POST   /api/bookings                          -> public: create a booking (logged-in or guest)
// PUT    /api/bookings?id=uuid                  -> admin: update status/details
// DELETE /api/bookings?id=uuid                  -> admin: delete

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  const { id, ref, status, camp_id, search } = req.query || {};

  // ---------- Public: look up a single booking by its reference ----------
  // Used on the booking confirmation page. Does not require login so a
  // guest can revisit their confirmation, but only returns non-sensitive
  // fields relevant to confirming the booking.
  if (req.method === 'GET' && ref && !id) {
    const { data, error } = await supabase
      .from('camp_bookings')
      .select('booking_ref, full_name, email, status, created_at, camp_id, prayer_camps(name, start_date, end_date, venue)')
      .eq('booking_ref', ref)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'No booking found with that reference.' });
    return res.status(200).json(data);
  }

  // ---------- Admin: list / search / single lookup by id ----------
  if (req.method === 'GET') {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    if (id) {
      const { data, error } = await supabase
        .from('camp_bookings')
        .select('*, prayer_camps(name, start_date, end_date, venue)')
        .eq('id', id)
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'Booking not found.' });
      return res.status(200).json(data);
    }

    let query = supabase
      .from('camp_bookings')
      .select('*, prayer_camps(name, start_date, end_date, venue)')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (camp_id) query = query.eq('camp_id', camp_id);
    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,phone_number.ilike.%${search}%,booking_ref.ilike.%${search}%`
      );
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // ---------- Public: create a booking ----------
  if (req.method === 'POST') {
    const {
      camp_id: bodyCampId, full_name, phone_number, email, gender,
      date_of_birth, emergency_contact, prayer_request, additional_notes,
    } = req.body || {};

    if (!bodyCampId || !full_name || !phone_number || !email || !emergency_contact) {
      return res.status(400).json({
        error: 'camp_id, full_name, phone_number, email, and emergency_contact are required.',
      });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    // Confirm the camp exists, is open, and has space
    const { data: camp, error: campError } = await supabase
      .from('camp_availability')
      .select('id, name, registration_open, available_spaces')
      .eq('id', bodyCampId)
      .maybeSingle();

    if (campError) return res.status(500).json({ error: campError.message });
    if (!camp) return res.status(404).json({ error: 'Camp not found.' });
    if (!camp.registration_open) {
      return res.status(400).json({ error: 'Registration for this camp is closed.' });
    }
    if (camp.available_spaces <= 0) {
      return res.status(400).json({ error: 'This camp is fully booked.' });
    }

    // If the request is authenticated, link the booking to the user
    let user_id = null;
    const token = getTokenFromRequest(req);
    if (token) {
      const decoded = verifyToken(token);
      if (decoded) user_id = decoded.id;
    }

    const { data, error } = await supabase
      .from('camp_bookings')
      .insert({
        camp_id: bodyCampId,
        user_id,
        full_name,
        phone_number,
        email,
        gender: gender || null,
        date_of_birth: date_of_birth || null,
        emergency_contact,
        prayer_request: prayer_request || null,
        additional_notes: additional_notes || null,
      })
      .select('id, booking_ref, full_name, email, status, created_at')
      .single();

    if (error) {
      // The DB trigger enforces capacity/registration-open atomically as a
      // safety net against race conditions; surface its message cleanly.
      const friendly = /fully booked|registration.*closed|Camp not found/i.test(error.message)
        ? error.message.replace(/^.*?:\s*/, '')
        : error.message;
      return res.status(400).json({ error: friendly });
    }
    return res.status(201).json({ ...data, camp_name: camp.name });
  }

  // ---------- Admin: update a booking ----------
  if (req.method === 'PUT') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    if (!id) return res.status(400).json({ error: 'id query param is required.' });

    const allowedFields = [
      'full_name', 'phone_number', 'email', 'gender', 'date_of_birth',
      'emergency_contact', 'prayer_request', 'additional_notes', 'status',
    ];
    const payload = {};
    for (const f of allowedFields) {
      if (req.body && f in req.body) payload[f] = req.body[f];
    }
    if (payload.status && !['Pending', 'Approved', 'Declined'].includes(payload.status)) {
      return res.status(400).json({ error: 'status must be Pending, Approved, or Declined.' });
    }

    const { data, error } = await supabase
      .from('camp_bookings')
      .update(payload)
      .eq('id', id)
      .select('*, prayer_camps(name, start_date, end_date, venue)')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // ---------- Admin: delete a booking ----------
  if (req.method === 'DELETE') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    if (!id) return res.status(400).json({ error: 'id query param is required.' });

    const { error } = await supabase.from('camp_bookings').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ message: 'Deleted.' });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
};
