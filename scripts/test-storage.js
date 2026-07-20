/**
 * ทดสอบ storage โหมด Netlify ด้วย store จำลอง ไม่แตะข้อมูลจริง
 *
 *   node scripts/test-storage.js
 *
 * ครอบคลุม: ย้ายข้อมูลจากรูปแบบเดิม, สร้าง/อ่าน/ลบ, ส่งพร้อมกันต้องไม่ทับกัน,
 * และ index ที่ตกหล่นต้องถูกสร้างใหม่เอง
 */
const path = require('path');
const Module = require('module');

// --- store จำลองในหน่วยความจำ แทน @netlify/blobs -------------------------
const blobs = new Map();
let setDelayMs = 0;

const fakeStore = {
  async get(key) {
    return blobs.has(key) ? blobs.get(key) : null;
  },
  async set(key, value) {
    // หน่วงเพื่อจำลองการเขียนที่ทับซ้อนกันของสองคำขอ
    if (setDelayMs) await new Promise((r) => setTimeout(r, setDelayMs));
    blobs.set(key, value);
  },
  async delete(key) {
    blobs.delete(key);
  },
  async list({ prefix } = {}) {
    return {
      blobs: [...blobs.keys()]
        .filter((k) => !prefix || k.startsWith(prefix))
        .map((key) => ({ key, etag: 'x' })),
      directories: [],
    };
  },
};

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === '@netlify/blobs') return '@netlify/blobs';
  return origResolve.call(this, request, ...rest);
};
require.cache['@netlify/blobs'] = {
  id: '@netlify/blobs',
  filename: '@netlify/blobs',
  loaded: true,
  exports: { getStore: () => fakeStore },
};

process.env.NETLIFY_BLOBS_CONTEXT = 'test';
const storage = require(path.join(__dirname, '..', 'storage.js'));

// --- helpers -------------------------------------------------------------
let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n        got      ${JSON.stringify(actual)}\n        expected ${JSON.stringify(expected)}`}`);
}

function makeRecord(id, name, position, company) {
  return {
    id,
    createdAt: '2026-07-20T00:00:00.000Z',
    updatedAt: '2026-07-20T00:00:00.000Z',
    status: 'submitted',
    data: {
      page1: { nameTh: name, positionApplied: position, idCardNo: `id-${id}` },
      workHistory: [{ company }],
    },
  };
}

(async () => {
  // 1) ย้ายข้อมูลจาก blob เดียวรูปแบบเดิม
  blobs.set(
    'applications',
    JSON.stringify([makeRecord('a1', 'ผู้สมัคร หนึ่ง', 'HR', 'บริษัท ก'), makeRecord('a2', 'ผู้สมัคร สอง', 'Sales', 'บริษัท ข')])
  );
  let list = await storage.listSummaries();
  check('ย้ายข้อมูลเดิมได้ครบ', list.length, 2);
  check('ยังเก็บ blob เดิมไว้เป็นสำรอง', blobs.has('applications'), true);
  check('แตกเป็น blob ต่อใบ', blobs.has('app/a1') && blobs.has('app/a2'), true);
  check('รายการมีเฉพาะฟิลด์ย่อ', Object.keys(list[0]).sort(), ['company', 'createdAt', 'id', 'name', 'position', 'search', 'status', 'updatedAt']);
  check('ไม่มีข้อมูลทั้งใบหลุดมากับรายการ', 'data' in list[0], false);

  // 2) อ่านใบเดียวได้ข้อมูลเต็ม
  const one = await storage.getRecord('a1');
  check('อ่านใบเดียวได้ข้อมูลเต็ม', one.data.page1.idCardNo, 'id-a1');
  check('อ่าน id ที่ไม่มีได้ null', await storage.getRecord('nope'), null);

  // 3) ส่งพร้อมกันต้องไม่ทับกัน — จุดที่พังในโครงสร้างเดิม
  setDelayMs = 30;
  await Promise.all([
    storage.putRecord(makeRecord('c1', 'พร้อมกัน หนึ่ง', 'Dev', 'บ.1')),
    storage.putRecord(makeRecord('c2', 'พร้อมกัน สอง', 'Dev', 'บ.2')),
    storage.putRecord(makeRecord('c3', 'พร้อมกัน สาม', 'Dev', 'บ.3')),
  ]);
  setDelayMs = 0;
  check('ใบสมัครที่ส่งพร้อมกันอยู่ครบทุกใบ', [...blobs.keys()].filter((k) => k.startsWith('app/')).length, 5);
  list = await storage.listSummaries();
  check('รายการแสดงครบหลังส่งพร้อมกัน (index สร้างใหม่เองถ้าตกหล่น)', list.length, 5);

  // 4) index เสียหาย/ตกหล่น ต้องกู้เองได้
  blobs.set('index', JSON.stringify([]));
  list = await storage.listSummaries();
  check('index ว่างเปล่าถูกสร้างใหม่จาก app/*', list.length, 5);
  blobs.delete('index');
  list = await storage.listSummaries();
  check('index หายไปถูกสร้างใหม่', list.length, 5);

  // 5) แก้ไขและลบ
  const edited = { ...makeRecord('a1', 'แก้ไขแล้ว', 'HR', 'บริษัท ก'), updatedAt: '2026-07-21T00:00:00.000Z' };
  await storage.putRecord(edited);
  list = await storage.listSummaries();
  check('แก้ไขแล้วไม่เพิ่มรายการซ้ำ', list.length, 5);
  check('แก้ไขแล้วชื่อในรายการอัปเดต', list.find((s) => s.id === 'a1').name, 'แก้ไขแล้ว');

  check('ลบใบที่มีอยู่คืน true', await storage.deleteRecord('a1'), true);
  check('ลบใบที่ไม่มีคืน false', await storage.deleteRecord('nope'), false);
  list = await storage.listSummaries();
  check('ลบแล้วหายจากรายการ', list.length, 4);
  check('ลบแล้ว blob ของใบนั้นหายจริง', blobs.has('app/a1'), false);

  // 6) ข้อความค้นหาถูกคำนวณไว้ให้แล้ว
  const s = (await storage.listSummaries()).find((x) => x.id === 'c1');
  check('search ครอบคลุมฟิลด์ลึก (เลขบัตร)', s.search.includes('id-c1'), true);
  check('search ครอบคลุมชื่อบริษัท', s.search.includes('บ.1'), true);

  console.log(failures ? `\n${failures} FAILED` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
})();
