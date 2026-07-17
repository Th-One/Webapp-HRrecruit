/* Shared paper-form renderer for F06-005 (used by view.html & preview.html) */
const EDU_LABEL = { primary: "ประถมศึกษา", m1: "มัธยมต้น", m2: "มัธยมปลาย/อาชีวฯ", diploma: "อนุปริญญา", bachelor: "ปริญญาตรี", master: "ปริญญาโท", other: "อื่นๆ" };
const LANGS = { english: "อังกฤษ", chinese: "จีน", japanese: "ญี่ปุ่น", other: "อื่นๆ" };

function esc(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function val(v) { return (v === 0 || v) ? esc(v) : ""; }
function opt(v, t) { return { v, t }; }
function fmtDate(iso) { if (!iso) return "—"; return new Date(iso).toLocaleString("th-TH", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }); }

function fill(label, value) {
  const v = (value === 0 || value) ? String(value) : "";
  return `<div class="fill"><span class="lbl">${esc(label)}</span><span class="val ${v ? "filled" : "empty"}">${esc(v)}</span></div>`;
}
function line(label, inner) {
  return `<div class="fill"><span class="lbl">${esc(label)}</span><span class="val filled">${inner}</span></div>`;
}
function choices(selected, options, circle = false) {
  const b = circle ? "box circle" : "box";
  return `<span class="choices">${options.map(o => `<span class="opt ${selected === o.v ? "on" : ""}"><span class="${b}"></span>${esc(o.t)}</span>`).join("")}</span>`;
}
function yn(selected) { return choices(selected, [opt("no", "ไม่มี"), opt("yes", "มี")], true); }
function nv(selected) { return choices(selected, [opt("no", "ไม่"), opt("yes", "มี")], true); }
function section(title, body) {
  return `<section class="paper-section"><h3 class="paper-section-title">${esc(title)}</h3><div class="paper-section-body">${body}</div></section>`;
}
function grid(cls, inner) { return `<div class="paper-grid ${cls}">${inner}</div>`; }
function ptable(headers, rows) {
  const body = rows.length
    ? rows.map(r => `<tr>${r.map(c => `<td>${val(c) || '<span class="empty">—</span>'}</td>`).join("")}</tr>`).join("")
    : `<tr><td class="empty" colspan="${headers.length}">—</td></tr>`;
  return `<table class="paper-table"><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`;
}
function fmtAddr(a = {}) {
  return [a.houseNo && `เลขที่ ${a.houseNo}`, a.moo && `หมู่ ${a.moo}`, a.village && `หมู่บ้าน ${a.village}`, a.soi && `ซอย ${a.soi}`, a.road && `ถนน ${a.road}`, a.tambon && `ต.${a.tambon}`, a.amphoe && `อ.${a.amphoe}`, a.province && `จ.${a.province}`, a.zip, a.phone && `โทร. ${a.phone}`].filter(Boolean).join(" ");
}

function renderPage1(p) {
  const f = p.father || {}, m = p.mother || {};
  let html = "";
  html += section("ข้อมูลการสมัคร", grid("pg-2",
    fill("ท่านทราบข่าวการรับสมัครจาก", p.heardFrom) + fill("สมัครตำแหน่ง", p.positionApplied) +
    fill("เงินเดือนที่ต้องการ", p.expectedSalary) + fill("วันที่พร้อมปฏิบัติงาน", p.availableDate)) +
    line("ท่านมีญาติหรือรู้จักกับผู้ใดใน บริษัท นีโอคอสเมด จำกัด หรือไม่", choices(p.knowsEmployee, [opt("no", "ไม่มี"), opt("yes", "มี ระบุ")], true)) +
    ptable(["ลำดับ", "ชื่อ-นามสกุล", "แผนก/ฝ่าย", "ความสัมพันธ์"], (p.knownEmployees || []).map((r, i) => [i + 1, r.name, r.dept, r.relation])));

  html += section("รายละเอียดส่วนตัวผู้สมัคร", grid("pg-2",
    fill("ชื่อ-นามสกุล (ภาษาไทย)", p.nameTh) + fill("ชื่อ-นามสกุล (ภาษาอังกฤษ)", p.nameEn) +
    fill("เชื้อชาติ", p.ethnicity) + fill("สัญชาติ", p.nationality) + fill("ศาสนา", p.religion) +
    fill("วัน เดือน ปี เกิด", p.birthDate) + fill("อายุ (ปี)", p.age) +
    fill("น้ำหนัก (กก.)", p.weight) + fill("ส่วนสูง (ซม.)", p.height) +
    fill("บัตรประชาชนเลขที่", p.idCardNo) + fill("ออกให้ ณ เขต/จังหวัด", p.idCardIssuedAt) +
    fill("วันที่ออกบัตร", p.idCardIssueDate) + fill("วันหมดอายุ", p.idCardExpiry)));

  html += section("ที่อยู่ตามทะเบียนบ้าน", grid("pg-3",
    fill("เลขที่", p.regAddress?.houseNo) + fill("หมู่ที่", p.regAddress?.moo) + fill("หมู่บ้าน", p.regAddress?.village) +
    fill("ตรอก/ซอย", p.regAddress?.soi) + fill("ถนน", p.regAddress?.road) + fill("ตำบล/แขวง", p.regAddress?.tambon) +
    fill("อำเภอ/เขต", p.regAddress?.amphoe) + fill("จังหวัด", p.regAddress?.province) + fill("รหัสไปรษณีย์", p.regAddress?.zip) +
    fill("โทรศัพท์", p.regAddress?.phone)));

  html += section("ที่อยู่ปัจจุบัน (ซึ่งติดต่อได้)", grid("pg-3",
    fill("เลขที่", p.curAddress?.houseNo) + fill("หมู่ที่", p.curAddress?.moo) + fill("หมู่บ้าน", p.curAddress?.village) +
    fill("ตรอก/ซอย", p.curAddress?.soi) + fill("ถนน", p.curAddress?.road) + fill("ตำบล/แขวง", p.curAddress?.tambon) +
    fill("อำเภอ/เขต", p.curAddress?.amphoe) + fill("จังหวัด", p.curAddress?.province) + fill("รหัสไปรษณีย์", p.curAddress?.zip) +
    fill("โทรศัพท์", p.curAddress?.phone)) +
    line("ปัจจุบันอาศัยอยู่", choices(p.livingType, [opt("dorm", "หอพัก"), opt("rent", "บ้านเช่า"), opt("own", "บ้านตัวเอง"), opt("parents", "บ้านบิดา-มารดา"), opt("other", "อื่นๆ")], true) + (p.livingOther ? " ระบุ " + esc(p.livingOther) : "")));

  html += section("บิดา / มารดา / พี่น้อง", grid("pg-2",
    fill("ชื่อ-นามสกุลของบิดา", f.name) + fill("อายุ (ปี)", f.age) + fill("สัญชาติ", f.nationality) + fill("เชื้อชาติ", f.ethnicity) +
    line("สถานะ", choices(f.alive, [opt("alive", "ยังมีชีวิตอยู่"), opt("deceased", "เสียชีวิตแล้ว")], true)) + fill("อาชีพ", f.occupation) + fill("สถานที่ทำงาน", f.workplace) +
    fill("ชื่อ-นามสกุลของมารดา", m.name) + fill("อายุ (ปี)", m.age) + fill("สัญชาติ", m.nationality) + fill("เชื้อชาติ", m.ethnicity) +
    line("สถานะ", choices(m.alive, [opt("alive", "ยังมีชีวิตอยู่"), opt("deceased", "เสียชีวิตแล้ว")], true)) + fill("อาชีพ", m.occupation) + fill("สถานที่ทำงาน", m.workplace)) +
    grid("pg-4", fill("จำนวนพี่น้อง (รวมผู้สมัคร) คน", p.siblings?.total) + fill("ชาย คน", p.siblings?.male) + fill("หญิง คน", p.siblings?.female) + fill("ผู้สมัครเป็นคนที่", p.siblings?.order)) +
    ptable(["ลำดับที่", "ชื่อ-นามสกุล", "อายุ (ปี)", "อาชีพ", "สถานที่ทำงาน/สถานศึกษา", "ตำแหน่งหน้าที่"], (p.siblings?.list || []).map((s, i) => [i + 1, s.name, s.age, s.occupation, s.workplace, s.position])));

  html += section("สุขภาพและประวัติเพิ่มเติม",
    line("ท่านสูบบุหรี่หรือไม่", choices(p.smoking, [opt("no", "ไม่สูบ"), opt("yes", "สูบ วันละ")], true) + (p.smokingPerDay ? " " + esc(p.smokingPerDay) + " มวน" : "")) +
    line("ท่านมีโรคประจำตัวหรือโรคเรื้อรังหรือไม่", choices(p.chronicDisease, [opt("no", "ไม่มี"), opt("yes", "มี ระบุ")], true) + (p.chronicDiseaseDetail ? " " + esc(p.chronicDiseaseDetail) : "")) +
    `<p class="note">ในช่วงระยะเวลา 5 ปี ที่ผ่านมา ท่านเคยได้รับบาดเจ็บหรือเป็นโรคติดต่อร้ายแรง จนไม่สามารถปฏิบัติงานเป็นเวลาติดต่อกันนานเกินกว่า 3 วัน หรือไม่</p>` +
    line("", choices(p.seriousIllness, [opt("never", "ไม่เคย"), opt("yes", "เคย")], true) + (p.seriousIllnessTimes ? " " + esc(p.seriousIllnessTimes) + " ครั้ง" : "") + (p.seriousIllnessReason ? " ด้วยสาเหตุ " + esc(p.seriousIllnessReason) : "")) +
    line("ท่านเคยต้องโทษทางคดีอาญาหรือคดีทางแพ่งหรือไม่", choices(p.legalCase, [opt("never", "ไม่เคย"), opt("yes", "เคย")], true) + (p.legalCaseTimes ? " " + esc(p.legalCaseTimes) + " ครั้ง" : "")) +
    fill("เนื้อหาของคดี คือ", p.legalCaseDetail));

  html += section("ความยินยอมให้ตรวจสอบข้อมูลส่วนบุคคล",
    `<div class="consent-box">ข้าพเจ้าขอรับรองว่าข้อมูลและเอกสารในการสมัครงานนี้เป็นความจริงทุกประการ กรณีที่บริษัทฯ ตรวจสอบพบภายหลังว่าข้อมูลไม่เป็นความจริง ข้าพเจ้ายินยอมให้บริษัทฯ เลิกจ้างได้โดยไม่ต้องบอกกล่าวล่วงหน้าหรือจ่ายค่าเสียหายใดๆ ทั้งสิ้น ข้าพเจ้าได้รับความยินยอมจากเจ้าของข้อมูลเพื่อให้บริษัทฯ รวบรวม จัดเก็บ ใช้ และตรวจสอบข้อมูลตามนโยบายของบริษัทฯ</div>` +
    `<div class="sign-row"><div><div class="sign-line">${p.consentAccepted ? esc(p.signatureName) : ""}</div><div class="sign-cap">ลงชื่อ ผู้สมัครงาน/ผู้ให้ข้อมูล/ผู้ยินยอม</div></div><div><div class="sign-line">${p.signatureDate ? esc(p.signatureDate) : ""}</div><div class="sign-cap">วันที่</div></div></div>` +
    `<p class="note" style="margin-top:0.6rem">สำหรับเจ้าหน้าที่</p>` +
    `<div class="sign-row"><div><div class="sign-line"></div><div class="sign-cap">ลงชื่อ เจ้าหน้าที่</div></div><div><div class="sign-line"></div><div class="sign-cap">วันที่</div></div></div>`);

  return html;
}

function renderPage2(d) {
  const m = d.marital || {}, spouse = m.spouse || {}, v = d.vehicles || {}, mil = d.military || {}, lang = d.languages || {};
  let html = "";
  html += section("สถานภาพการสมรสและครอบครัว",
    line("สถานภาพ", choices(m.status, [opt("single", "โสด"), opt("widowed", "หม้าย"), opt("divorced", "หย่าร้าง"), opt("married", "มีสามี-ภรรยา")], true)) +
    (m.status === "married" ? grid("pg-3", fill("สมรส เมื่อ พ.ศ.", m.marriedYear) + fill("จดทะเบียนสมรส เมื่อ พ.ศ.", m.registeredYear) + line("ไม่ได้จดทะเบียนสมรส", m.notRegistered ? '<span class="opt on"><span class="box"></span>ใช่</span>' : '<span class="opt"><span class="box"></span>ไม่ใช่</span>')) +
      grid("pg-2", fill("ชื่อ-นามสกุลคู่สมรส/สามี-ภรรยา", spouse.name) + fill("อายุ (ปี)", spouse.age) + fill("สัญชาติ", spouse.nationality) + fill("เชื้อชาติ", spouse.ethnicity) + line("สถานะ", choices(spouse.alive, [opt("alive", "ยังมีชีวิตอยู่"), opt("deceased", "เสียชีวิตแล้ว")], true)) + fill("อาชีพ", spouse.occupation) + fill("สถานที่ทำงาน", spouse.workplace) + fill("ตำแหน่ง", spouse.position)) : "") +
    fill("มีบุตร รวม (คน)", m.childrenCount) +
    ptable(["ลำดับ", "เพศ", "ปีเกิด (พ.ศ.)"], (m.children || []).map((c, i) => [i + 1, c.gender, c.birthYear])));

  const langRows = ["english", "chinese", "japanese", "other"].map(k => { const r = lang[k] || {}; const name = k === "other" ? (r.name ? "อื่นๆ (" + r.name + ")" : "อื่นๆ") : LANGS[k]; return [name, r.speak, r.write, r.read, r.listen]; });
  html += section("ความสามารถทางภาษา", `<p class="note">ระบุ ดีมาก, ดี, พอใช้, น้อย</p>` + ptable(["ภาษา", "พูด", "เขียน", "อ่าน", "ฟัง"], langRows));

  html += section("ความสามารถพิเศษ", fill("โปรแกรมคอมพิวเตอร์ ระบุ", d.skills?.computer) + fill("ความสามารถพิเศษอื่นๆ ระบุ", d.skills?.other));

  html += section("สถานภาพทางทหาร",
    line("", choices(mil.status, [opt("served", "เกณฑ์ทหารแล้ว"), opt("upcoming", "จะเกณฑ์ทหารในปี พ.ศ."), opt("exempt", "ได้รับยกเว้น เพราะ")], true) + (mil.status === "upcoming" ? " " + esc(mil.year) : "") + (mil.status === "exempt" ? " " + esc(mil.exemptReason) : "")));

  html += section("ประวัติการศึกษา", ptable(
    ["ระดับการศึกษา", "ชื่อสถานศึกษา", "ระยะเวลา (จาก พ.ศ.)", "ถึง พ.ศ.", "วุฒิที่ได้รับ", "สาขาวิชา", "เกรดเฉลี่ย"],
    (d.education || []).map(e => [e.level === "other" ? (e.otherLevel || "อื่นๆ") : (EDU_LABEL[e.level] || e.level), e.school, e.from, e.to, e.degree, e.major, e.gpa])));

  html += section("ความสามารถในการขับขี่ยานพาหนะ",
    line("คุณมีรถยนต์ส่วนตัวหรือไม่", yn(v.hasCar) + (v.carDetail ? " ระบุ " + esc(v.carDetail) : "")) +
    line("ใบขับขี่รถยนต์", yn(v.hasCarLicense) + (v.hasCarLicense === "yes" ? " " + choices(v.carLicenseType, [opt("yearly", "รายปี"), opt("lifetime", "ตลอดชีพ")], true) : "") + (v.carLicenseNo ? " เลขที่ " + esc(v.carLicenseNo) : "")) +
    line("คุณมีรถจักรยานยนต์ส่วนตัวหรือไม่", yn(v.hasMotorcycle) + (v.motorcycleDetail ? " ระบุ " + esc(v.motorcycleDetail) : "")) +
    line("ใบขับขี่รถจักรยานยนต์", yn(v.hasMotorcycleLicense) + (v.hasMotorcycleLicense === "yes" ? " " + choices(v.motorcycleLicenseType, [opt("yearly", "รายปี"), opt("lifetime", "ตลอดชีพ")], true) : "") + (v.motorcycleLicenseNo ? " เลขที่ " + esc(v.motorcycleLicenseNo) : "")));

  html += section("รายชื่อบุคคลอ้างอิง", ptable(
    ["ลำดับ", "ชื่อ – นามสกุล", "ความสัมพันธ์", "อาชีพ/ตำแหน่ง", "ที่อยู่ซึ่งติดต่อได้", "โทรศัพท์"],
    (d.references || []).map((r, i) => [i + 1, r.name, r.relation, r.occupation, r.address, r.phone])));

  html += section("ประวัติการทำงาน (เริ่มจากปัจจุบันไปสู่อดีต)", ptable(
    ["ชื่อบริษัท", "ประเภทกิจการ", "ตำแหน่งเริ่มต้น", "ตำแหน่งสุดท้าย", "หน้าที่รับผิดชอบ", "อัตราค่าจ้าง/เงินเดือน", "สาเหตุที่ออก", "จาก วัน/เดือน/ปี", "ถึง วัน/เดือน/ปี"],
    (d.workHistory || []).map(w => [w.company, w.businessType, w.startPosition, w.endPosition, w.responsibilities, (w.salaryStart || "") + (w.salaryEnd ? " - " + w.salaryEnd : ""), w.leaveReason, w.fromDate, w.toDate])));

  html += section("งานอดิเรกและกิจกรรม", fill("งานอดิเรก กิจกรรม และกีฬา", d.hobbies) +
    ptable(["สมาชิกสมาคม / ชมรม / สหภาพแรงงาน", "ตำแหน่ง"], (d.clubs || []).map(c => [c.name, c.position])));

  html += section("การฝึกอบรม ดูงาน ฝึกงาน", ptable(
    ["หลักสูตร", "สถาบัน", "จาก", "ถึง"],
    (d.trainings || []).map(t => [t.course, t.institute, t.from, t.to])));

  return html;
}

function renderPaper(data, meta) {
  const d = data || {};
  const p = d.page1 || {};
  const docNo = meta?.docNo || "F06-005 Rev.2";
  const stamp = meta?.stamp || "";
  const photoHtml = p.photoData ? `<img src="${esc(p.photoData)}" alt="รูปถ่าย" />` : `<span class="ph-label">รูปถ่าย</span>`;
  const emg = p.emergencyContacts || [];
  const emgHtml = `<div class="emg-box">
    <p class="emg-title">กรณีที่บริษัทไม่สามารถติดต่อผู้สมัครได้ สามารถติดต่อบุคคลต่อไปนี้ได้ ระบุ</p>
    ${[1, 2].map(i => { const r = emg[i - 1] || {}; return `<div class="emg-row"><div class="emg-no">${i}.</div><div class="emg-detail"><div class="fill"><span class="lbl">ชื่อ-นามสกุล</span><span class="val ${r.name ? "filled" : "empty"}">${esc(r.name || "")}</span><span class="lbl" style="margin-left:0.6rem">ความสัมพันธ์</span><span class="val ${r.relation ? "filled" : "empty"}">${esc(r.relation || "")}</span></div><div class="fill"><span class="lbl">ที่อยู่</span><span class="val ${r.address ? "filled" : "empty"}">${esc(r.address || "")}</span><span class="lbl" style="margin-left:0.6rem">โทรศัพท์</span><span class="val ${r.phone ? "filled" : "empty"}">${esc(r.phone || "")}</span></div></div></div>`; }).join("")}
  </div>`;
  const head = `<div class="paper-head"><div class="titles"><h1>ใบสมัครงาน</h1><p class="company">บริษัท นีโอคอสเมด จำกัด</p><p class="doc-no">${esc(docNo)}${stamp ? " · " + esc(stamp) : ""}</p></div><div class="paper-photo">${photoHtml}</div></div>`;
  const privacy = `<p class="paper-privacy">โปรดกรอกข้อมูลให้ครบถ้วนตามความจริง เพื่อประโยชน์ของผู้สมัครงาน บริษัทฯ จะเก็บข้อมูลนี้เป็นความลับตามกฎหมาย พ.ร.บ.คุ้มครองข้อมูลส่วนบุคคล</p>`;
  return head + privacy + emgHtml + renderPage1(p) + `<div class="page-break"></div>` + renderPage2(d);
}
