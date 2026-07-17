const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const {
  readApplications,
  writeApplications,
  isNetlifyRuntime,
} = require('./storage');

const app = express();
const PORT = process.env.PORT || 3000;
const GENERATED_DIR = isNetlifyRuntime()
  ? path.join('/tmp', 'hrregister-generated')
  : path.join(__dirname, 'generated');
const GENERATOR = path.join(__dirname, 'generate_f06.py');

if (!isNetlifyRuntime() && !fs.existsSync(GENERATED_DIR)) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
}

function resolvePython() {
  const localPython = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Python', 'Python313', 'python.exe')
    : '';
  return process.env.PYTHON_PATH || (fs.existsSync(localPython) ? localPython : 'python');
}

function pdfUnavailable(res) {
  return res.status(503).json({
    error: 'การสร้าง PDF ใช้งานได้เฉพาะเซิร์ฟเวอร์ภายใน (ต้องมี Python)',
    detail: 'Netlify รองรับฟอร์มและการบันทึกข้อมูล แต่ไม่รองรับการสร้าง PDF แบบ serverless',
  });
}

app.use(express.json({ limit: '10mb' }));

if (!isNetlifyRuntime()) {
  app.use(express.static(path.join(__dirname, 'public')));
}

function ensureGeneratedDir() {
  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
  }
}

app.post('/api/f06/preview', async (req, res) => {
  if (isNetlifyRuntime()) return pdfUnavailable(res);

  ensureGeneratedDir();
  const token = uuidv4();
  const input = path.join(GENERATED_DIR, `${token}-preview.json`);
  const output = path.join(GENERATED_DIR, `${token}-preview.pdf`);
  fs.writeFileSync(input, JSON.stringify(req.body || {}), 'utf8');
  const result = spawnSync(
    resolvePython(),
    [GENERATOR, '--data', input, '--output', output],
    { encoding: 'utf8', timeout: 120000 }
  );
  fs.rmSync(input, { force: true });
  if (result.status !== 0 || !fs.existsSync(output)) {
    return res.status(500).json({
      error: 'สร้างตัวอย่าง PDF ไม่สำเร็จ',
      detail: (result.stderr || result.stdout || result.error?.message || '').trim(),
    });
  }
  res.type('application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="F06-005-preview.pdf"');
  return res.sendFile(output, () => fs.rmSync(output, { force: true }));
});

app.get('/api/applications', async (req, res) => {
  const list = (await readApplications()).sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  );
  res.json(list);
});

app.get('/api/applications/:id/f06.pdf', async (req, res) => {
  if (isNetlifyRuntime()) return pdfUnavailable(res);

  ensureGeneratedDir();
  const list = await readApplications();
  const item = list.find((a) => a.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'ไม่พบใบสมัคร' });

  const dataFile = path.join(GENERATED_DIR, `${req.params.id}-data.json`);
  fs.writeFileSync(dataFile, JSON.stringify(list, null, 2), 'utf8');
  const output = path.join(GENERATED_DIR, `${req.params.id}-F06-005.pdf`);
  const result = spawnSync(
    resolvePython(),
    [GENERATOR, '--data', dataFile, '--id', req.params.id, '--output', output],
    { encoding: 'utf8', timeout: 120000 }
  );
  fs.rmSync(dataFile, { force: true });
  if (result.status !== 0 || !fs.existsSync(output)) {
    return res.status(500).json({
      error: 'สร้าง PDF ไม่สำเร็จ',
      detail: (result.stderr || result.stdout || result.error?.message || '').trim(),
    });
  }
  if (req.query.inline === '1') {
    res.type('application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="F06-005-${req.params.id}.pdf"`);
    return res.sendFile(output);
  }
  return res.download(output, `F06-005-${req.params.id}.pdf`);
});

app.get('/api/applications/:id', async (req, res) => {
  const list = await readApplications();
  const item = list.find((a) => a.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'ไม่พบใบสมัคร' });
  res.json(item);
});

app.post('/api/applications', async (req, res) => {
  const now = new Date().toISOString();
  const list = await readApplications();
  const record = {
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
    status: 'submitted',
    data: req.body || {},
  };
  list.push(record);
  await writeApplications(list);
  res.status(201).json(record);
});

app.put('/api/applications/:id', async (req, res) => {
  const list = await readApplications();
  const idx = list.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'ไม่พบใบสมัคร' });
  list[idx] = {
    ...list[idx],
    updatedAt: new Date().toISOString(),
    data: req.body || {},
  };
  await writeApplications(list);
  res.json(list[idx]);
});

app.delete('/api/applications/:id', async (req, res) => {
  const list = await readApplications();
  const next = list.filter((a) => a.id !== req.params.id);
  if (next.length === list.length) {
    return res.status(404).json({ error: 'ไม่พบใบสมัคร' });
  }
  await writeApplications(next);
  res.json({ ok: true });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`HRregister running at http://localhost:${PORT}`);
  });
}

module.exports = { app };
