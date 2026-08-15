const { supabase } = require('../../lib/supabase');
const { comparePassword, signToken, applyCors } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('id, full_name, email, phone, password_hash, role')
    .eq('email', email.toLowerCase().trim())
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: error.message });
  }
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const valid = await comparePassword(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const token = signToken(user);
  delete user.password_hash;

  return res.status(200).json({ token, user });
};
