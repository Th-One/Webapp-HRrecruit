const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const {
  readApplications,
  writeApplications,
  isNetlifyRuntime,
} = require('./storage');
const { generateF06Pdf } = require('./pdf/generate-f06');

const app = express();
const PORT = process.env.PORT || 3000;

// ต้องตรงกับ PHOTO_UPLOAD_ENABLED ใน public/js/form.js
// ปิดไว้เพราะรูป base64 กินโควตา payload 6 MB ของ Netlify Function
// ตัดฝั่ง server ด้วย กัน client เก่า/ที่แคชไว้ส่งรูปเข้ามา
const PHOTO_UPLOAD_ENABLED = false;

// Express 4 ไม่จับ rejection จาก async handler ให้เอง ถ้าไม่ห่อไว้ request จะค้าง
// จนหมดเวลาแทนที่จะตอบ 500 — จำเป็นเพราะ storage โยน error ออกมาแล้วเมื่อ Blobs ล้ม
function wrap(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function stripPhoto(data) {
  if (PHOTO_UPLOAD_ENABLED) return data;
  if (!data || typeof data !== 'object' || !data.page1) return data;
  const { photoData, ...page1 } = data.page1;
  return { ...data, page1 };
}

app.use(express.json({ limit: '10mb' }));

if (!isNetlifyRuntime()) {
  app.use(express.static(path.join(__dirname, 'public')));
}

app.post('/api/f06/preview', async (req, res) => {
  try {
    const pdfBytes = await generateF06Pdf(req.body || {});
    res.type('application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="F06-005-preview.pdf"');
    return res.send(Buffer.from(pdfBytes));
  } catch (err) {
    return res.status(500).json({
      error: 'สร้างตัวอย่าง PDF ไม่สำเร็จ',
      detail: (err && err.message) || String(err),
    });
  }
});

app.get('/api/applications', wrap(async (req, res) => {
  const list = (await readApplications()).sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  );
  res.json(list);
}));

app.get('/api/applications/:id/f06.pdf', wrap(async (req, res) => {
  const list = await readApplications();
  const item = list.find((a) => a.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'ไม่พบใบสมัคร' });

  try {
    const pdfBytes = await generateF06Pdf(item);
    const buffer = Buffer.from(pdfBytes);
    const disposition = req.query.inline === '1' ? 'inline' : 'attachment';
    res.type('application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="F06-005-${req.params.id}.pdf"`
    );
    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({
      error: 'สร้าง PDF ไม่สำเร็จ',
      detail: (err && err.message) || String(err),
    });
  }
}));

app.get('/api/applications/:id', wrap(async (req, res) => {
  const list = await readApplications();
  const item = list.find((a) => a.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'ไม่พบใบสมัคร' });
  res.json(item);
}));

app.post('/api/applications', wrap(async (req, res) => {
  const now = new Date().toISOString();
  const list = await readApplications();
  const record = {
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
    status: 'submitted',
    data: stripPhoto(req.body || {}),
  };
  list.push(record);
  await writeApplications(list);
  res.status(201).json(record);
}));

app.put('/api/applications/:id', wrap(async (req, res) => {
  const list = await readApplications();
  const idx = list.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'ไม่พบใบสมัคร' });
  list[idx] = {
    ...list[idx],
    updatedAt: new Date().toISOString(),
    data: stripPhoto(req.body || {}),
  };
  await writeApplications(list);
  res.json(list[idx]);
}));

app.delete('/api/applications/:id', wrap(async (req, res) => {
  const list = await readApplications();
  const next = list.filter((a) => a.id !== req.params.id);
  if (next.length === list.length) {
    return res.status(404).json({ error: 'ไม่พบใบสมัคร' });
  }
  await writeApplications(next);
  res.json({ ok: true });
}));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในระบบ' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`HRregister running at http://localhost:${PORT}`);
  });
}

module.exports = { app };
