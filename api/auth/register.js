const { supabase } = require('../../lib/supabase');
const { hashPassword, signToken, applyCors } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { full_name, email, password, phone, gender, date_of_birth } = req.body || {};

  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'full_name, email, and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const password_hash = await hashPassword(password);

  const { data: user, error } = await supabase
    .from('users')
    .insert({
      full_name,
      email: normalizedEmail,
      password_hash,
      phone: phone || null,
      gender: gender || null,
      date_of_birth: date_of_birth || null,
      role: 'user',
    })
    .select('id, full_name, email, phone, role')
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const token = signToken(user);
  return res.status(201).json({ token, user });
};
