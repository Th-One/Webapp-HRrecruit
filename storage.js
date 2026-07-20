const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'applications.json');

// แต่ละใบสมัครเก็บเป็น blob ของตัวเอง = แหล่งความจริง
// เขียนคนละ key จึงไม่มี read-modify-write ใบสมัครที่ส่งพร้อมกันทับกันไม่ได้
const RECORD_PREFIX = 'app/';
// สรุปย่อสำหรับหน้า HR อ่านครั้งเดียวได้ทั้งรายการ สร้างใหม่จาก app/* ได้เสมอ
const INDEX_KEY = 'index';
// รูปแบบเดิมที่เก็บทุกใบรวมใน blob เดียว เก็บไว้เป็นสำรอง ไม่ลบ
const LEGACY_KEY = 'applications';

// ตรวจจาก NETLIFY_BLOBS_CONTEXT เป็นหลัก เพราะ Netlify ตั้งค่านี้ให้เมื่อ Blobs
// พร้อมใช้งาน จึงตรงกับสิ่งที่เรากำลังตัดสินใจที่สุด
//
// ยืนยันจาก runtime จริงบน Netlify (ผ่าน draft deploy):
//   NETLIFY=false  NETLIFY_DEV=false
//   NETLIFY_BLOBS_CONTEXT=true  AWS_EXECUTION_ENV=true  AWS_LAMBDA_FUNCTION_NAME=true
//
// จงใจไม่ใช้ AWS_LAMBDA_FUNCTION_NAME เพราะเคยค้างใน shell ของเครื่อง dev
// ทำให้ local ถูกมองเป็น Netlify และไม่ใช้ AWS_EXECUTION_ENV เพราะเป็นของ AWS
// ไม่ใช่สัญญาของ Netlify (AWS เคยถอดออกใน runtime บางรุ่น)
function isNetlifyRuntime() {
  return Boolean(
    process.env.NETLIFY_BLOBS_CONTEXT ||
      process.env.NETLIFY ||
      process.env.NETLIFY_DEV
  );
}

async function getBlobStore() {
  const { getStore } = require('@netlify/blobs');
  return getStore({ name: 'hrregister-data' });
}

// ---------------------------------------------------------------- summary

// ข้อความสำหรับช่องค้นหาในหน้า HR — คำนวณตอนบันทึกเพื่อให้รายการส่งข้อมูลย่อได้
// โดยที่การค้นหายังครอบคลุมฟิลด์ลึกเหมือนเดิม
function buildSearchText(record) {
  const d = record.data || {};
  const p = d.page1 || {};
  const parts = [
    p.nameTh,
    p.nameEn,
    p.positionApplied,
    p.idCardNo,
    p.curAddress && p.curAddress.phone,
    p.regAddress && p.regAddress.phone,
    d.marital && d.marital.spouse && d.marital.spouse.name,
    d.skills && d.skills.computer,
    d.skills && d.skills.other,
    d.hobbies,
    ...(d.workHistory || []).flatMap((w) => [w.company, w.endPosition]),
    ...(d.references || []).flatMap((r) => [r.name, r.phone]),
    ...(d.education || []).map((e) => e.school),
  ];
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function toSummary(record) {
  const d = record.data || {};
  const p = d.page1 || {};
  return {
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    status: record.status,
    name: p.nameTh || p.nameEn || '',
    position: p.positionApplied || '',
    company: (d.workHistory && d.workHistory[0] && d.workHistory[0].company) || '',
    search: buildSearchText(record),
  };
}

// ---------------------------------------------------------------- local

function ensureLocalDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

function readLocalAll() {
  ensureLocalDataFile();
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeLocalAll(list) {
  ensureLocalDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf8');
}

// ---------------------------------------------------------------- netlify

function recordKey(id) {
  return `${RECORD_PREFIX}${id}`;
}

async function readIndex(store) {
  const raw = await store.get(INDEX_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// สร้าง index ใหม่จาก app/* ซึ่งเป็นแหล่งความจริง ใช้เมื่อ index หายหรือไม่ตรง
async function rebuildIndex(store) {
  const { blobs } = await store.list({ prefix: RECORD_PREFIX });
  const summaries = await Promise.all(
    blobs.map(async ({ key }) => {
      const raw = await store.get(key);
      if (!raw) return null;
      try {
        return toSummary(JSON.parse(raw));
      } catch {
        return null;
      }
    })
  );
  const list = summaries.filter(Boolean);
  await store.set(INDEX_KEY, JSON.stringify(list));
  return list;
}

// ย้ายจาก blob เดียวที่รวมทุกใบ ไปเป็น blob ต่อใบ ทำครั้งเดียวและซ้ำได้ปลอดภัย
// ไม่ลบ blob เดิม เก็บไว้เป็นสำรอง
async function migrateLegacy(store) {
  const raw = await store.get(LEGACY_KEY);
  if (!raw) return [];
  let list;
  try {
    list = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(list) || !list.length) return [];

  await Promise.all(
    list.map((record) => store.set(recordKey(record.id), JSON.stringify(record)))
  );
  const summaries = list.map(toSummary);
  await store.set(INDEX_KEY, JSON.stringify(summaries));
  return summaries;
}

// index ที่ใช้งานได้ — ถ้าไม่มีให้ย้ายข้อมูลเดิมหรือสร้างใหม่จาก app/*
async function ensureIndex(store) {
  const index = await readIndex(store);
  if (index) return index;
  const migrated = await migrateLegacy(store);
  if (migrated.length) return migrated;
  return rebuildIndex(store);
}

// ---------------------------------------------------------------- api

async function listSummaries() {
  if (!isNetlifyRuntime()) {
    return readLocalAll().map(toSummary);
  }
  const store = await getBlobStore();
  const index = await ensureIndex(store);
  // app/* คือแหล่งความจริง ถ้าจำนวนไม่ตรง แปลว่า index ตกหล่น (เช่นเขียนชนกัน)
  // ให้สร้างใหม่เพื่อให้รายการครบเสมอ
  const { blobs } = await store.list({ prefix: RECORD_PREFIX });
  if (blobs.length !== index.length) return rebuildIndex(store);
  return index;
}

async function getRecord(id) {
  if (!isNetlifyRuntime()) {
    return readLocalAll().find((r) => r.id === id) || null;
  }
  const store = await getBlobStore();
  const raw = await store.get(recordKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`ใบสมัคร ${id} ใน Netlify Blobs เสียหาย: ${err.message}`);
  }
}

async function putRecord(record) {
  if (!isNetlifyRuntime()) {
    const list = readLocalAll();
    const idx = list.findIndex((r) => r.id === record.id);
    if (idx === -1) list.push(record);
    else list[idx] = record;
    writeLocalAll(list);
    return record;
  }
  const store = await getBlobStore();
  // เขียนตัวใบสมัครก่อนเสมอ ถ้าขั้นนี้สำเร็จข้อมูลจะไม่หายแม้ index จะพลาด
  await store.set(recordKey(record.id), JSON.stringify(record));
  await refreshIndexEntry(store, toSummary(record));
  return record;
}

async function deleteRecord(id) {
  if (!isNetlifyRuntime()) {
    const list = readLocalAll();
    const next = list.filter((r) => r.id !== id);
    if (next.length === list.length) return false;
    writeLocalAll(next);
    return true;
  }
  const store = await getBlobStore();
  const existing = await store.get(recordKey(id));
  if (!existing) return false;
  await store.delete(recordKey(id));
  const index = (await readIndex(store)) || [];
  await store.set(INDEX_KEY, JSON.stringify(index.filter((s) => s.id !== id)));
  return true;
}

// index เป็นเพียงดัชนีเร่งความเร็ว ถ้าอัปเดตพลาดจาก race listSummaries จะตรวจเจอ
// แล้วสร้างใหม่ให้เอง จึงไม่ทำให้ใบสมัครหาย
async function refreshIndexEntry(store, summary) {
  const index = (await readIndex(store)) || [];
  const next = index.filter((s) => s.id !== summary.id);
  next.push(summary);
  await store.set(INDEX_KEY, JSON.stringify(next));
}

module.exports = {
  listSummaries,
  getRecord,
  putRecord,
  deleteRecord,
  isNetlifyRuntime,
  toSummary,
};
