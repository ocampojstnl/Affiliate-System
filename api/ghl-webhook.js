export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const GHL_WEBHOOK_URL = process.env.GHL_WEBHOOK_URL

  if (!GHL_WEBHOOK_URL) {
    return res.status(500).json({ error: 'GHL_WEBHOOK_URL not configured' })
  }

  try {
    const response = await fetch(GHL_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    })

    const text = await response.text()
    res.status(response.status).send(text)
  } catch (err) {
    console.error('GHL webhook proxy error:', err.message)
    res.status(502).json({ error: 'Failed to reach GHL webhook' })
  }
}
