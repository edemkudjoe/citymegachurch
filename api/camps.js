const { supabase } = require('../lib/supabase');
const { applyCors, requireAdmin } = require('../lib/auth');

// GET /api/camps          -> public list, includes availability
// GET /api/camps?id=uuid  -> single camp with availability
// POST /api/camps         -> admin create
// PUT /api/camps?id=uuid  -> admin update (dates, capacity, open/close registration)
// DELETE /api/camps?id=uuid -> admin delete

const ALLOWED_FIELDS = [
  'name', 'description', 'start_date', 'end_date', 'venue',
  'max_participants', 'registration_open', 'cover_image_url',
];

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  const { id } = req.query || {};

  if (req.method === 'GET') {
    if (id) {
      const { data, error } = await supabase
        .from('camp_availability')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'Camp not found.' });

      return res.status(200).json(data);
    }

    const { data, error } = await supabase
      .from('camp_availability')
      .select('*')
      .order('start_date', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    const payload = {};
    for (const f of ALLOWED_FIELDS) {
      if (req.body && f in req.body) payload[f] = req.body[f];
    }
    if (!payload.name || !payload.start_date || !payload.end_date) {
      return res.status(400).json({ error: 'name, start_date, and end_date are required.' });
    }
    if (new Date(payload.end_date) < new Date(payload.start_date)) {
      return res.status(400).json({ error: 'end_date cannot be before start_date.' });
    }

    const { data, error } = await supabase.from('prayer_camps').insert(payload).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  if (req.method === 'PUT') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    if (!id) return res.status(400).json({ error: 'id query param is required.' });

    const payload = {};
    for (const f of ALLOWED_FIELDS) {
      if (req.body && f in req.body) payload[f] = req.body[f];
    }
    if (payload.start_date && payload.end_date && new Date(payload.end_date) < new Date(payload.start_date)) {
      return res.status(400).json({ error: 'end_date cannot be before start_date.' });
    }

    const { data, error } = await supabase.from('prayer_camps').update(payload).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    if (!id) return res.status(400).json({ error: 'id query param is required.' });

    const { error } = await supabase.from('prayer_camps').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ message: 'Deleted.' });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
};
