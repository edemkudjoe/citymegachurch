const { supabase } = require('../lib/supabase');
const { applyCors, requireAdmin } = require('../lib/auth');

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('church_info')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'PUT') {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    const allowedFields = [
      'church_name', 'slogan', 'hero_image_url', 'hero_video_url', 'welcome_message',
      'history', 'vision', 'mission', 'core_values', 'lead_pastor_name',
      'lead_pastor_bio', 'lead_pastor_image_url', 'address', 'phone', 'email',
      'google_maps_embed_url', 'facebook_url', 'instagram_url', 'twitter_url',
      'youtube_url', 'tiktok_url',
    ];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body && field in req.body) updates[field] = req.body[field];
    }

    const { data, error } = await supabase
      .from('church_info')
      .update(updates)
      .eq('id', 1)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed.' });
};
