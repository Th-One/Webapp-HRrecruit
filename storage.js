const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'applications.json');
const BLOB_KEY = 'applications';

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
    // ไม่ fallback ไปไฟล์ชั่วคราว — ถ้าอ่าน Blobs ไม่ได้แล้วคืน [] เงียบๆ
    // หน้า HR จะขึ้นว่า "ไม่พบใบสมัคร" ทั้งที่ข้อมูลยังอยู่ ซึ่งอันตรายกว่าการแจ้ง error
    const store = await getBlobStore();
    const raw = await store.get(BLOB_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch (err) {
      throw new Error(`ข้อมูลใน Netlify Blobs เสียหาย อ่านไม่ได้: ${err.message}`);
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
    // ปล่อยให้ error หลุดขึ้นไปเป็น HTTP 500 ผู้สมัครจะเห็นว่าส่งไม่สำเร็จและลองใหม่ได้
    // เดิม fallback ไปเขียน /tmp ซึ่งผู้สมัครเห็นว่าบันทึกสำเร็จ แต่ข้อมูลหายเมื่อ
    // Lambda container ถูกรีไซเคิล — เป็นการสูญหายแบบเงียบที่แย่ที่สุด
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
