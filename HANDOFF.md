# 📋 สรุปโปรเจกต์ HRregister (Handoff)

## 1. เป้าหมายโปรเจกต์
สร้างเว็บแอปใบสมัครงานตามแบบฟอร์ม **F06-005 Rev.2** ของ **บริษัท นีโอคอสเมด จำกัด** (เอกสารต้นฉบับ 2 หน้า อยู่ที่ `\\192.168.100.140\software\`)

> อัปเดต 16 ก.ค. 2569: ระบบใช้ไฟล์ PDF ต้นฉบับ `Page1.pdf` และหน้าที่ 1
> ของ `Page2.pdf` เป็นพื้นหลังคงที่ขนาด A3 แนวนอน แล้ววางข้อมูลทับตามพิกัด
> ด้วย `generate_f06.py` ไม่ใช้การจำลอง HTML หรือแปลง DOCX ผ่าน LibreOffice

**ข้อกำหนดหลัก:**
1. ฟิลด์ทั้งหมดตรงกับเอกสาร F06-005 หน้า 1 และ 2 เท่านั้น (ไม่เอานอกเหนือเอกสาร)
2. ผู้สมัครกรอกในเว็บ → ข้อมูลเข้าไปในแบบฟอร์ม F06-005 → บันทึกเป็น PDF ส่ง HR
3. HR ได้ไฟล์ F06-005 ที่มีข้อมูลผู้กรอก ตามขนาดเอกสาร 2 หน้า (A4)
4. มีช่องอัปโหลดรูปถ่าย + ดูตัวอย่าง (preview) ก่อน/หลังบันทึก PDF
5. ฟอนต์ **Sarabun** + ดีไซน์สวย friendly น่ากรอก
6. Stack: **HTML + Express** (มี PowerShell server สำรองเพราะเครื่องไม่มี Node)

## 2. โครงสร้างไฟล์

```
C:\Users\automation\HRregister\
├── server.js              Express API + static (port 3000) — ใช้ไม่ได้เพราะเครื่องไม่มี npm
├── start.ps1              ★ PowerShell HTTP server (ใช้งานจริง) — รันอยู่
├── package.json
├── README.md
├── sample-data.json       ข้อมูลตัวอย่างผู้สมัคร (สมชาย ใจดี)
├── data/applications.json ที่เก็บข้อมูล JSON (มี 1 record ตัวอย่าง)
└── public/
    ├── index.html         ★ ฟอร์มผู้สมัคร (หน้า 1+2 ครบ) — มี progress bar, photo upload, preview btn
    ├── preview.html       หน้าดูตัวอย่างก่อนบันทึก
    ├── css/
    │   ├── style.css      สไตล์ฟอร์มกรอก (Sarabun, friendly)
    │   └── form-paper.css ★ สไตล์แบบฟอร์มกระดาษ A4 สำหรับ PDF
    ├── js/
    │   ├── form.js        ★ logic ฟอร์มกรอก (collectForm, photo, progress, preview, restore)
    │   ├── paper-render.js ★★ ตัว render แบบฟอร์ม F06-005 (ใช้ร่วม view+preview)
    │   ├── view.js       หน้า HR view (เรียก renderPaper)
    │   ├── preview.js    หน้า preview (อ่าน sessionStorage เรียก renderPaper)
    │   └── hr.js         หน้ารายการ HR
    └── hr/
        ├── index.html    หน้ารายการ HR
        └── view.html     หน้าดู/พิมพ์ PDF ของ HR
```

## 3. วิธีรัน
```powershell
cd C:\Users\automation\HRregister
.\start.ps1            # รันอยู่แล้วที่ http://localhost:3000
# หรือเปลี่ยนพอร์ต: .\start.ps1 -Port 3001
```

## 4. API (PowerShell server)
| Method | Path | รายละเอียด |
|--------|------|-----------|
| GET | `/api/applications` | รายการทั้งหมด |
| GET | `/api/applications/:id` | รายการเดียว |
| POST | `/api/applications` | สร้างใหม่ |
| PUT | `/api/applications/:id` | แก้ไข |
| DELETE | `/api/applications/:id` | ลบ |

## 5. โครงสร้างข้อมูล (data model)
บันทึกเป็น `{ id, createdAt, updatedAt, status, data }` โดย `data` มี:
- `page1` — ข้อมูลหน้า 1 (heardFrom, positionApplied, expectedSalary, availableDate, knowsEmployee, knownEmployees[], nameTh/En, ethnicity, nationality, religion, birthDate, age, weight, height, idCard*, photoData, regAddress{}, curAddress{}, livingType, father{}, mother{}, siblings{total,male,female,order,list[]}, emergencyContacts[], smoking, chronicDisease, seriousIllness, legalCase, consentAccepted, signatureName, signatureDate)
- `marital` — status, marriedYear, registeredYear, notRegistered, spouse{}, childrenCount, children[]
- `languages` — english/chinese/japanese/other {speak,write,read,listen}
- `skills` — computer, other
- `military` — status, year, exemptReason
- `education[]` — level, otherLevel, school, from, to, degree, major, gpa
- `vehicles` — hasCar, carDetail, hasCarLicense, carLicenseType, carLicenseNo, hasMotorcycle, motorcycleDetail, hasMotorcycleLicense, motorcycleLicenseType, motorcycleLicenseNo
- `references[]` — name, relation, occupation, address, phone
- `workHistory[]` — company, businessType, startPosition, endPosition, responsibilities, salaryStart, salaryEnd, fromDate, toDate, leaveReason
- `hobbies`, `clubs[]`, `trainings[]`

## 6. สถานะปัจจุบัน (ทำเสร็จแล้ว)
- ✅ ฟอร์มกรอกครบหน้า 1+2 ตามเอกสาร
- ✅ อัปโหลดรูปถ่าย (drag&drop + preview + ลบรูป)
- ✅ Progress bar แสดง % กรอก
- ✅ ปุ่ม "ดูตัวอย่าง" → `/preview.html` (sessionStorage)
- ✅ บันทึก → ไปหน้า view → ปุ่ม "บันทึก PDF ส่ง HR"
- ✅ หน้า HR รายการ + ค้นหา + ลบ
- ✅ ฟอนต์ Sarabun, ดีไซน์ friendly
- ✅ ตัวอย่างข้อมูล (สมชาย ใจดี) บันทึกแล้ว
- ✅ เซิร์ฟเวอร์รันอยู่ API ตอบ 200

## 7. ⚠️ ปัญหา/สิ่งที่ต้องแก้ต่อ

### 7.1 PDF ยังไม่ "ตรงกับเอกสารต้นฉบับ 100%"
- ปัจจุบัน render เป็น HTML/CSS จำลองแบบฟอร์ม F06-005 (ดูคล้ายแต่ไม่ใช่ไฟล์ต้นฉบับ)
- **ที่ผู้ใช้ต้องการจริง:** ข้อมูลไหลเข้าไฟล์ F06-005 ต้นฉบับ (docx/PDF) แล้วบันทึกเป็น PDF ที่ตรงกับเอกสารต้นฉบับทุกบรรทัด
- **แนวทางแก้:**
  - ใช้ไลบรารีเติมข้อมูลลง PDF ต้นฉบับ เช่น `pdf-lib` / `pdf-form-fill` (ต้องมี Node) หรือ `pypdf`/`fillpdf` (ต้องมี Python)
  - หรือแปลง docx ต้นฉบับเป็น PDF ที่มี form fields แล้วกรอก
  - เครื่องนี้ไม่มี Node/Python ติดตั้ง → ต้องติดตั้งก่อน หรือทำบนเครื่องอื่น
  - ไฟล์ต้นฉบับ: `\\192.168.100.140\software\F06-005 Rev.2 ใบสมัครงาน (ภาษาไทย) (Page1).docx.docx` และ `...Page2...docx.docx`

### 7.2 เครื่องไม่มี Node.js / Python
- `npm` ไม่มี → `server.js` (Express) ใช้ไม่ได้
- ใช้ `start.ps1` (PowerShell HttpListener) แทนอยู่
- หากจะใช้ไลบรารี PDF ต้องติดตั้ง runtime ก่อน

### 7.3 ลำดับ/เลย์เอาต์หน้า 1 ยังไม่ตรงเอกสารเป๊ะ
- เอกสารต้นฉบับหน้า 1 มี "ช่องติดต่อฉุกเฉิน" อยู่ด้านบนขวา (sidebar) และ "รูปถ่าย" อยู่ข้างส่วนตัว
- ปัจจุบัน render เป็นแบบ section เรียงลงมา ไม่ได้จำลองตำแหน่งเดิมเป๊ะ → ควรปรับ `paper-render.js` ให้ตรง layout ต้นฉบับ

### 7.4 ฟิลด์ที่อาจต้องตรวจกับเอกสารอีกครั้ง
- ตารางพี่น้อง (ลำดับที่/ชื่อ/อายุ/อาชีพ/สถานที่ทำงาน/ตำแหน่ง)
- ตารางการศึกษา (คอลัมน์ "ระยะเวลา" รวม จาก-ถึง)
- ตารางประวัติงาน (คอลัมน์ "ระยะเวลา" + "อัตราค่าจ้าง/เงินเดือน")
- ส่วน "สำหรับเจ้าหน้าที่" มีในเอกสารหน้า 1

## 8. ข้อมูลอ้างอิงเอกสารต้นฉบับ (extract แล้ว)
- **หน้า 1:** บริษัท/ช่องติดต่อฉุกเฉิน/ใบสมัครงาน/ทราบข่าว/สมัครตำแหน่ง/เงินเดือน/ญาติในบริษัท/ส่วนตัว/บัตรประชาชน/รูปถ่าย/ที่อยู่ 2 แบบ/บิดา-มารดา-พี่น้อง/สูบบุหรี่/โรค/คดี/ความยินยอม/ลายเซ็น/สำหรับเจ้าหน้าที่
- **หน้า 2:** สถานภาพสมรส+ครอบครัว/ภาษา(อังกฤษ-จีน-ญี่ปุ่น-อื่นๆ × พูด-เขียน-อ่าน-ฟัง)/ทักษะพิเศษ/ทหาร/การศึกษา/ขับขี่/บุคคลอ้างอิง/ประวัติงาน/งานอดิเรก-ชมรม/ฝึกอบรม

## 9. คำสั่งที่เป็นประโยชน์
```powershell
# รันเซิร์ฟเวอร์
cd C:\Users\automation\HRregister; .\start.ps1

# ดูข้อมูลที่บันทึก
Invoke-RestMethod -Uri 'http://localhost:3000/api/applications'

# ส่งข้อมูลตัวอย่าง
$body = Get-Content sample-data.json -Raw -Encoding UTF8
$bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
Invoke-RestMethod -Uri 'http://localhost:3000/api/applications' -Method POST -ContentType 'application/json; charset=utf-8' -Body $bytes
```

## 10. ลำดับความสำคัญในการแก้ต่อ
1. **(สูงสุด)** ทำให้ PDF output เป็นไฟล์ F06-005 ต้นฉบับที่มีข้อมูลกรอก โดยติดตั้ง Node หรือ Python แล้วใช้ไลบรารีเติม PDF/docx
2. ปรับ `paper-render.js` ให้ layout ตรงตำแหน่งเอกสารต้นฉบับ (หน้า 1 โดยเฉพาะ)
3. ตรวจฟิลด์/คอลัมน์ตารางให้ตรงเอกสาร 100%
4. (ทางเลือก) ทำให้ HR ดาวน์โหลดได้ทั้ง PDF และ docx ที่กรอกแล้ว

## 11. หมายเหตุ
- เซิร์ฟเวอร์ PowerShell รันอยู่เบื้องหลังที่ http://localhost:3000
- หากต้องการรันใหม่: `cd C:\Users\automation\HRregister; .\start.ps1`
- ตัวอย่างข้อมูลผู้สมัคร: สมชาย ใจดี (สมัครพนักงานขาย) ดูได้ที่หน้า HR
