const { supabase } = require('../lib/supabase');
const { applyCors, requireAdmin } = require('../lib/auth');

// Expects a JSON body with base64 file data:
// { file_name, file_base64, content_type, bucket }
// bucket must be one of the allowed buckets below.
const ALLOWED_BUCKETS = ['gallery', 'sermons', 'events', 'articles', 'church-assets'];

module.exports = async (req, res) => {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const admin = requireAdmin(req, res);
  if (!admin) return;

  const { file_name, file_base64, content_type, bucket } = req.body || {};

  if (!file_name || !file_base64 || !content_type || !bucket) {
    return res.status(400).json({
      error: 'file_name, file_base64, content_type, and bucket are all required.',
    });
  }
  if (!ALLOWED_BUCKETS.includes(bucket)) {
    return res.status(400).json({ error: `bucket must be one of: ${ALLOWED_BUCKETS.join(', ')}` });
  }

  const buffer = Buffer.from(file_base64, 'base64');
  const MAX_SIZE = 25 * 1024 * 1024; // 25MB
  if (buffer.length > MAX_SIZE) {
    return res.status(400).json({ error: 'File exceeds 25MB limit.' });
  }

  const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, buffer, { contentType: content_type, upsert: false });

  if (uploadError) {
    return res.status(500).json({ error: uploadError.message });
  }

  const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path);

  return res.status(201).json({ url: publicUrlData.publicUrl, path });
};
