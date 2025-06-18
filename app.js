import express from 'express';
import fetch from 'node-fetch';
import FormData from 'form-data';

const app = express();
app.use(express.json());

const API_KEY = process.env.NEOCITIES_API_KEY;

app.post('/append', async (req, res) => {
  try {
    const newText = req.body.newText;
    const filename = 'data.txt';

    // 1. Fetch existing content
    const old = await fetch(`https://${process.env.NEOCITIES_SITE}.neocities.org/${filename}`)
      .then(r => r.ok ? r.text() : '');

    const combined = old + '\n' + newText;

    // 2. Upload via API
    const form = new FormData();
    form.append('file', Buffer.from(combined), filename);

    const apiRes = await fetch('https://neocities.org/api/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${API_KEY}` },
      body: form
    });
    const result = await apiRes.json();

    return res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Append failed' });
  }
});

app.listen(process.env.PORT || 10000, () => console.log('Service started'));
