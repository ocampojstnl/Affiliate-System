import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 10000
const GHL_WEBHOOK_URL = process.env.GHL_WEBHOOK_URL

app.use(express.json())

// Serve static files from dist
app.use(express.static(path.join(__dirname, 'dist')))

// Proxy endpoint for GHL webhook — avoids CORS issues
app.post('/api/ghl-webhook', async (req, res) => {
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
})

// SPA fallback — serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
