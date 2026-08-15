const { supabase } = require('../lib/supabase');
const { applyCors, requireAdmin } = require('../lib/auth');

// Gallery gets a custom handler (not the generic CRUD builder) because
// of tag-based filtering support.
module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  const { id, tag } = req.query || {};

  if (req.method === 'GET') {
    if (id) {
      const { data, error } = await supabase.from('gallery').select('*').eq('id', id).maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'Not found.' });
      return res.status(200).json(data);
    }

    let query = supabase.from('gallery').select('*').order('display_order', { ascending: true });
    if (tag) query = query.contains('tags', [tag]);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const { image_url, caption, tags, display_order } = req.body || {};
    if (!image_url) return res.status(400).json({ error: 'image_url is required.' });

    const { data, error } = await supabase
      .from('gallery')
      .insert({ image_url, caption, tags: tags || [], display_order: display_order || 0 })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  if (req.method === 'PUT') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    if (!id) return res.status(400).json({ error: 'id query param is required.' });

    const payload = {};
    for (const f of ['image_url', 'caption', 'tags', 'display_order']) {
      if (req.body && f in req.body) payload[f] = req.body[f];
    }

    const { data, error } = await supabase.from('gallery').update(payload).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    if (!id) return res.status(400).json({ error: 'id query param is required.' });

    const { error } = await supabase.from('gallery').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ message: 'Deleted.' });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
};
