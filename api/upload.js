import { put } from '@vercel/blob';

export const config = {
  api: {
    bodyParser: false, // Stream request directly to Vercel Blob
  },
};

export default async function handler(req, res) {
  // Set CORS headers so local development or domain aliases can upload
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, x-pathname, x-ping',
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify Admin authorization
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const validSecret = process.env.ADMIN_UPLOAD_SECRET || 'h4-admin';

  if (!token || token !== validSecret) {
    return res
      .status(401)
      .json({ error: 'Unauthorized: Invalid or missing admin credentials' });
  }

  // Healthcheck / ping test
  if (req.headers['x-ping'] === 'true') {
    return res.status(200).json({
      ok: true,
      message: 'Upload API is connected and ready (Vercel Ambient OIDC).',
    });
  }

  const rawPathname = req.headers['x-pathname'];
  if (!rawPathname) {
    return res.status(400).json({ error: 'Missing x-pathname header' });
  }

  const pathname = String(rawPathname)
    .replaceAll(/[^a-zA-Z0-9_\-\./]/g, '_')
    .replaceAll(/_+/g, '_');

  const contentType = req.headers['content-type'] || 'image/png';

  try {
    // Uses ambient Vercel OIDC credentials automatically
    const blob = await put(pathname, req, {
      access: 'public',
      contentType,
    });

    return res.status(200).json({
      url: blob.url,
      downloadUrl: blob.downloadUrl,
      pathname: blob.pathname,
      contentType: blob.contentType,
    });
  } catch (error) {
    console.error('Vercel Blob upload failed:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error while uploading to Blob',
    });
  }
}
