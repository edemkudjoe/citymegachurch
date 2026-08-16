const { supabase } = require('../lib/supabase');
const { applyCors, requireAdmin, verifyToken } = require('../lib/auth');

function slugify(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Consolidates several small content tables into one serverless function
// to stay under Vercel's function-count limits. Routed by ?type=
//   GET/POST/PUT/DELETE /api/content?type=services
//   GET/POST/PUT/DELETE /api/content?type=ministries
//   GET/POST/PUT/DELETE /api/content?type=events
//   GET/POST/PUT/DELETE /api/content?type=sermons
//   GET/POST/PUT/DELETE /api/content?type=articles

const TABLE_CONFIG = {
  services: {
    table: 'services',
    publicFilter: { column: 'is_active', value: true },
    orderBy: { column: 'display_order', ascending: true },
    allowedFields: ['name', 'day_of_week', 'time', 'venue', 'description', 'image_url', 'display_order', 'is_active'],
  },
  ministries: {
    table: 'ministries',
    publicFilter: { column: 'is_active', value: true },
    orderBy: { column: 'display_order', ascending: true },
    allowedFields: ['name', 'description', 'image_url', 'leader_name', 'display_order', 'is_active'],
  },
  events: {
    table: 'events',
    publicFilter: { column: 'is_published', value: true },
    orderBy: { column: 'event_date', ascending: true },
    allowedFields: ['title', 'event_date', 'event_time', 'venue', 'description', 'image_url', 'is_published'],
  },
  sermons: {
    table: 'sermons',
    publicFilter: { column: 'is_published', value: true },
    orderBy: { column: 'sermon_date', ascending: false },
    allowedFields: [
      'title', 'speaker', 'sermon_date', 'youtube_url', 'audio_url',
      'notes_url', 'cover_image_url', 'description', 'is_published',
    ],
  },
  articles: {
    table: 'articles',
    publicFilter: { column: 'is_published', value: true },
    orderBy: { column: 'created_at', ascending: false },
    allowedFields: ['title', 'content', 'cover_image_url', 'author_name', 'is_published'],
    // Articles need a unique slug generated from the title at creation time.
    async beforeCreate(payload) {
      if (!payload.title) return payload;
      let slug = slugify(payload.title);
      const { data: existing } = await supabase.from('articles').select('id').eq('slug', slug).maybeSingle();
      if (existing) slug = `${slug}-${Date.now().toString(36)}`;
      return { ...payload, slug };
    },
  },
};

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  const { type, id } = req.query || {};

  const config = TABLE_CONFIG[type];
  if (!config) {
    return res.status(400).json({ error: `type must be one of: ${Object.keys(TABLE_CONFIG).join(', ')}` });
  }
  const { table, publicFilter, orderBy, allowedFields, beforeCreate } = config;

  if (req.method === 'GET') {
    // Admin requests (with a valid admin token) see everything, including
    // inactive/unpublished items, so the admin UI can manage drafts.
    const authHeader = req.headers.authorization || '';
    let isAdmin = false;
    if (authHeader.startsWith('Bearer ')) {
      const decoded = verifyToken(authHeader.slice(7));
      isAdmin = decoded && decoded.role === 'admin';
    }

    if (id) {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'Not found.' });
      return res.status(200).json(data);
    }

    let query = supabase.from(table).select('*');
    if (!isAdmin && publicFilter) query = query.eq(publicFilter.column, publicFilter.value);
    if (orderBy) query = query.order(orderBy.column, { ascending: orderBy.ascending });

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const admin = requireAdmin(req, res);
    if (!admin) return;

    let payload = {};
    for (const f of allowedFields) {
      if (req.body && f in req.body) payload[f] = req.body[f];
    }
    if (beforeCreate) payload = await beforeCreate(payload);

    if (type === 'articles' && (!payload.title || !payload.content)) {
      return res.status(400).json({ error: 'title and content are required.' });
    }

    const { data, error } = await supabase.from(table).insert(payload).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  if (req.method === 'PUT') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    if (!id) return res.status(400).json({ error: 'id query param is required.' });

    const payload = {};
    for (const f of allowedFields) {
      if (req.body && f in req.body) payload[f] = req.body[f];
    }

    const { data, error } = await supabase.from(table).update(payload).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    if (!id) return res.status(400).json({ error: 'id query param is required.' });

    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ message: 'Deleted.' });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
};
