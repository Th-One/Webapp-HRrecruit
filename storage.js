const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'applications.json');
const BLOB_KEY = 'applications';

function isNetlifyRuntime() {
  return Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

async function getBlobStore() {
  const { getStore } = require('@netlify/blobs');
  return getStore({ name: 'hrregister-data', consistency: 'strong' });
}

function ensureLocalDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]', 'utf8');
  }
}

async function readApplications() {
  if (isNetlifyRuntime()) {
    const store = await getBlobStore();
    const raw = await store.get(BLOB_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  ensureLocalDataFile();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeApplications(list) {
  const json = JSON.stringify(list, null, 2);
  if (isNetlifyRuntime()) {
    const store = await getBlobStore();
    await store.set(BLOB_KEY, json);
    return;
  }

  ensureLocalDataFile();
  fs.writeFileSync(DATA_FILE, json, 'utf8');
}

module.exports = {
  readApplications,
  writeApplications,
  isNetlifyRuntime,
};
