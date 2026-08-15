const { supabase } = require('../lib/supabase');
const { hashPassword, applyCors } = require('../lib/auth');

// ONE-TIME USE: creates the first admin account.
// Protected by a SETUP_SECRET env var so randoms can't call it.
// After you've created your admin, delete this file (or leave the
// env var unset) so it can never be called again.
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { setup_secret, full_name, email, password, phone } = req.body || {};

  if (!process.env.SETUP_SECRET || setup_secret !== process.env.SETUP_SECRET) {
    return res.status(403).json({ error: 'Invalid setup secret.' });
  }
  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'full_name, email, and password are required.' });
  }

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: 'A user with this email already exists.' });
  }

  const password_hash = await hashPassword(password);

  const { data, error } = await supabase
    .from('users')
    .insert({ full_name, email, phone, password_hash, role: 'admin' })
    .select('id, full_name, email, role')
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({ message: 'Admin account created.', user: data });
};
