# HRregister

ใบสมัครงานตามแบบฟอร์มต้นฉบับ **F06-005 Rev.2 หน้า 1–2**

## ฟีเจอร์

- ฟอร์มผู้สมัคร (ฟิลด์ตามเอกสาร)
- บันทึกประวัติลงไฟล์ JSON
- หน้า HR ดูรายการ / ค้นหา / ลบ
- กรอกข้อมูลลงไฟล์ F06-005 ต้นฉบับและดาวน์โหลด PDF 2 หน้า ขนาด A3 แนวนอน

## เริ่มใช้งาน (แนะนำ — ไม่ต้องติดตั้ง Node)

```powershell
cd C:\Users\automation\HRregister
.\start.ps1
```

เปิด http://localhost:3000

การสร้าง PDF ต้องมี Python 3 และแพ็กเกจ Python:

```powershell
python -m pip install -r requirements.txt
```

ระบบใช้ PDF ต้นฉบับใน `templates/` เป็นพื้นหลังแบบคงที่ แล้วเขียนเฉพาะ
ข้อมูลผู้สมัครทับตามตำแหน่งเดิม จึงไม่เปลี่ยนขนาด เส้น ตาราง หรือการจัดหน้า

### ทางเลือก: Node.js

```bash
npm install
npm start
```
