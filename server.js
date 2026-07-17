const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'applications.json');
const GENERATED_DIR = path.join(__dirname, 'generated');
const GENERATOR = path.join(__dirname, 'generate_f06.py');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}
if (!fs.existsSync(GENERATED_DIR)) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
}

function readApplications() {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeApplications(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf8');
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/f06/preview', (req, res) => {
  const token = uuidv4();
  const input = path.join(GENERATED_DIR, `${token}-preview.json`);
  const output = path.join(GENERATED_DIR, `${token}-preview.pdf`);
  fs.writeFileSync(input, JSON.stringify(req.body || {}), 'utf8');
  const localPython = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Python', 'Python313', 'python.exe')
    : '';
  const python = process.env.PYTHON_PATH || (fs.existsSync(localPython) ? localPython : 'python');
  const result = spawnSync(
    python,
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

app.get('/api/applications', (req, res) => {
  const list = readApplications().sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  );
  res.json(list);
});

app.get('/api/applications/:id/f06.pdf', (req, res) => {
  const item = readApplications().find((a) => a.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'ไม่พบใบสมัคร' });
  const localPython = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Python', 'Python313', 'python.exe')
    : '';
  const python = process.env.PYTHON_PATH || (fs.existsSync(localPython) ? localPython : 'python');
  const output = path.join(GENERATED_DIR, `${req.params.id}-F06-005.pdf`);
  const result = spawnSync(
    python,
    [GENERATOR, '--data', DATA_FILE, '--id', req.params.id, '--output', output],
    { encoding: 'utf8', timeout: 120000 }
  );
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

app.get('/api/applications/:id', (req, res) => {
  const item = readApplications().find((a) => a.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'ไม่พบใบสมัคร' });
  res.json(item);
});

app.post('/api/applications', (req, res) => {
  const now = new Date().toISOString();
  const list = readApplications();
  const record = {
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
    status: 'submitted',
    data: req.body || {},
  };
  list.push(record);
  writeApplications(list);
  res.status(201).json(record);
});

app.put('/api/applications/:id', (req, res) => {
  const list = readApplications();
  const idx = list.findIndex((a) => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'ไม่พบใบสมัคร' });
  list[idx] = {
    ...list[idx],
    updatedAt: new Date().toISOString(),
    data: req.body || {},
  };
  writeApplications(list);
  res.json(list[idx]);
});

app.delete('/api/applications/:id', (req, res) => {
  const list = readApplications();
  const next = list.filter((a) => a.id !== req.params.id);
  if (next.length === list.length) {
    return res.status(404).json({ error: 'ไม่พบใบสมัคร' });
  }
  writeApplications(next);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`HRregister running at http://localhost:${PORT}`);
});
