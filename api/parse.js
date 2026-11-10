// Vercel serverless function: POST /api/parse  { text } -> quotation JSON
import { parseOrder, checkPassword } from '../lib/parse.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  if (!checkPassword(req.headers['x-app-password'])) return res.status(401).json({ error: 'Wrong password' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    res.status(200).json(await parseOrder(body.text));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
