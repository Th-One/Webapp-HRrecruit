const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'applications.json');
const TMP_DATA_FILE = path.join('/tmp', 'hrregister-applications.json');
const BLOB_KEY = 'applications';

function isNetlifyRuntime() {
  return Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

async function getBlobStore() {
  const { getStore } = require('@netlify/blobs');
  return getStore({ name: 'hrregister-data' });
}

function ensureLocalDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]', 'utf8');
  }
}

function readTmpApplications() {
  if (!fs.existsSync(TMP_DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(TMP_DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeTmpApplications(list) {
  fs.writeFileSync(TMP_DATA_FILE, JSON.stringify(list, null, 2), 'utf8');
}

async function readApplications() {
  if (isNetlifyRuntime()) {
    try {
      const store = await getBlobStore();
      const raw = await store.get(BLOB_KEY);
      if (!raw) return [];
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    } catch (err) {
      console.error('Netlify Blobs read failed:', err.message);
      return readTmpApplications();
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
    try {
      const store = await getBlobStore();
      await store.set(BLOB_KEY, json);
      return;
    } catch (err) {
      console.error('Netlify Blobs write failed:', err.message);
      writeTmpApplications(list);
      return;
    }
  }

  ensureLocalDataFile();
  fs.writeFileSync(DATA_FILE, json, 'utf8');
}

module.exports = {
  readApplications,
  writeApplications,
  isNetlifyRuntime,
};
