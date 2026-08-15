const { supabase } = require('../lib/supabase');
const { applyCors, requireAuth } = require('../lib/auth');

// GET /api/profile -> the logged-in user's own profile
// PUT /api/profile -> update own profile (name, phone, gender, DOB, emergency contact)
// Users can only ever read/write their own record — the id always comes
// from the verified JWT, never from the request body.

const ALLOWED_FIELDS = ['full_name', 'phone', 'gender', 'date_of_birth', 'emergency_contact'];

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  const decoded = requireAuth(req, res);
  if (!decoded) return;

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, phone, role, gender, date_of_birth, emergency_contact, created_at')
      .eq('id', decoded.id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'User not found.' });
    return res.status(200).json(data);
  }

  if (req.method === 'PUT') {
    const payload = {};
    for (const f of ALLOWED_FIELDS) {
      if (req.body && f in req.body) payload[f] = req.body[f];
    }
    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided to update.' });
    }
    if (payload.full_name !== undefined && !payload.full_name.trim()) {
      return res.status(400).json({ error: 'full_name cannot be empty.' });
    }

    const { data, error } = await supabase
      .from('users')
      .update(payload)
      .eq('id', decoded.id)
      .select('id, full_name, email, phone, role, gender, date_of_birth, emergency_contact, created_at')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed.' });
};
