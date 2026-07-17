const LANG_LEVELS = ["", "ดีมาก", "ดี", "พอใช้", "น้อย"];
const EDU_KEYS = ["primary", "m1", "m2", "diploma", "bachelor", "master", "other"];
const PROGRESS_SECTIONS = [
  { id: "sec-apply", label: "ข้อมูลการสมัคร" },
  { id: "sec-personal", label: "ข้อมูลส่วนตัว" },
  { id: "sec-addr-reg", label: "ที่อยู่ทะเบียน" },
  { id: "sec-addr-cur", label: "ที่อยู่ปัจจุบัน" },
  { id: "sec-parents", label: "บิดา/มารดา/พี่น้อง" },
  { id: "sec-emergency", label: "ผู้ติดต่อฉุกเฉิน" },
  { id: "sec-health", label: "สุขภาพ" },
  { id: "sec-consent", label: "ความยินยอม" },
  { id: "sec-marital", label: "สถานภาพสมรส" },
  { id: "sec-lang", label: "ภาษา" },
  { id: "sec-skills", label: "ทักษะพิเศษ" },
  { id: "sec-military", label: "ทหาร" },
  { id: "sec-edu", label: "การศึกษา" },
  { id: "sec-vehicle", label: "ขับขี่" },
  { id: "sec-ref", label: "บุคคลอ้างอิง" },
  { id: "sec-work", label: "ประวัติงาน" },
  { id: "sec-hobby", label: "งานอดิเรก" },
  { id: "sec-train", label: "ฝึกอบรม" },
];

function updateProgress() {
  const form = document.getElementById("application-form");
  const inputs = form.querySelectorAll("input[type='text'], input[type='number'], input[type='tel'], input[type='date'], textarea, select");
  let filled = 0, total = 0;
  inputs.forEach((el) => {
    if (!el.name) return;
    total++;
    if (el.value && el.value.trim()) filled++;
  });
  const pct = total ? Math.round((filled / total) * 100) : 0;
  document.getElementById("progress-fill").style.width = pct + "%";
  document.getElementById("progress-pct").textContent = pct + "%";

  const stepsEl = document.getElementById("progress-steps");
  stepsEl.innerHTML = PROGRESS_SECTIONS.map((s) => {
    const sec = document.getElementById(s.id);
    if (!sec) return "";
    const secInputs = sec.querySelectorAll("input[type='text'], input[type='number'], input[type='tel'], input[type='date'], textarea, select");
    let has = false;
    secInputs.forEach((el) => { if (el.value && el.value.trim()) has = true; });
    return `<span class="step ${has ? "done" : ""}">${s.label}</span>`;
  }).join("");
}

function toast(msg, isError = false) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.toggle("error", isError);
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 3200);
}

function fillLangSelects() {
  document.querySelectorAll("#lang-table select").forEach((sel) => {
    sel.innerHTML = LANG_LEVELS.map((v) => {
      const label = v || "—";
      return `<option value="${v}">${label}</option>`;
    }).join("");
  });
}

function renderChildrenRows(count) {
  const tbody = document.querySelector("#children-table tbody");
  const n = Math.min(Math.max(Number(count) || 0, 0), 6);
  tbody.innerHTML = "";
  for (let i = 1; i <= n; i++) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i}</td>
      <td><input name="child${i}_gender" /></td>
      <td><input name="child${i}_birthYear" /></td>
    `;
    tbody.appendChild(tr);
  }
}

function addWork(data = {}) {
  const tpl = document.getElementById("tpl-work");
  const node = tpl.content.cloneNode(true);
  const root = node.querySelector(".work-item");
  root.querySelectorAll("[data-field]").forEach((el) => {
    el.value = data[el.dataset.field] || "";
  });
  root.querySelector(".remove-work").addEventListener("click", () => root.remove());
  document.getElementById("work-list").appendChild(node);
}

function addClub(data = {}) {
  const tpl = document.getElementById("tpl-club");
  const node = tpl.content.cloneNode(true);
  const root = node.querySelector(".club-item");
  root.querySelectorAll("[data-field]").forEach((el) => {
    el.value = data[el.dataset.field] || "";
  });
  root.querySelector(".remove-club").addEventListener("click", () => root.remove());
  document.getElementById("club-list").appendChild(node);
}

function addTrain(data = {}) {
  const tpl = document.getElementById("tpl-train");
  const node = tpl.content.cloneNode(true);
  const root = node.querySelector(".train-item");
  root.querySelectorAll("[data-field]").forEach((el) => {
    el.value = data[el.dataset.field] || "";
  });
  root.querySelector(".remove-train").addEventListener("click", () => root.remove());
  document.getElementById("train-list").appendChild(node);
}

function addSibling(data = {}) {
  const tpl = document.getElementById("tpl-sibling");
  const node = tpl.content.cloneNode(true);
  const root = node.querySelector(".sibling-item");
  root.querySelectorAll("[data-field]").forEach((el) => {
    el.value = data[el.dataset.field] || "";
  });
  root.querySelector(".remove-sibling").addEventListener("click", () => root.remove());
  document.getElementById("sibling-list").appendChild(node);
}

function radioVal(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : "";
}

function collectDynamic(selector) {
  return [...document.querySelectorAll(selector)].map((item) => {
    const o = {};
    item.querySelectorAll("[data-field]").forEach((el) => {
      o[el.dataset.field] = el.value || "";
    });
    return o;
  });
}

function addressFrom(prefix, fd) {
  return {
    houseNo: fd.get(`${prefix}HouseNo`) || "",
    moo: fd.get(`${prefix}Moo`) || "",
    village: fd.get(`${prefix}Village`) || "",
    soi: fd.get(`${prefix}Soi`) || "",
    road: fd.get(`${prefix}Road`) || "",
    tambon: fd.get(`${prefix}Tambon`) || "",
    amphoe: fd.get(`${prefix}Amphoe`) || "",
    province: fd.get(`${prefix}Province`) || "",
    zip: fd.get(`${prefix}Zip`) || "",
    phone: fd.get(`${prefix}Phone`) || "",
  };
}

function collectForm() {
  const form = document.getElementById("application-form");
  const fd = new FormData(form);

  const children = [];
  const count = Math.min(Number(fd.get("childrenCount")) || 0, 6);
  for (let i = 1; i <= count; i++) {
    children.push({
      gender: fd.get(`child${i}_gender`) || "",
      birthYear: fd.get(`child${i}_birthYear`) || "",
    });
  }

  const languages = {};
  ["english", "chinese", "japanese", "other"].forEach((lang) => {
    languages[lang] = {
      speak: fd.get(`lang_${lang}_speak`) || "",
      write: fd.get(`lang_${lang}_write`) || "",
      read: fd.get(`lang_${lang}_read`) || "",
      listen: fd.get(`lang_${lang}_listen`) || "",
    };
  });
  languages.other.name = fd.get("lang_other_name") || "";

  const education = EDU_KEYS.map((key) => ({
    level: key,
    otherLevel: key === "other" ? fd.get("edu_other_level") || "" : "",
    school: fd.get(`edu_${key}_school`) || "",
    from: fd.get(`edu_${key}_from`) || "",
    to: fd.get(`edu_${key}_to`) || "",
    degree: fd.get(`edu_${key}_degree`) || "",
    major: fd.get(`edu_${key}_major`) || "",
    gpa: fd.get(`edu_${key}_gpa`) || "",
  }));

  const references = [1, 2, 3].map((i) => ({
    name: fd.get(`ref${i}_name`) || "",
    relation: fd.get(`ref${i}_relation`) || "",
    occupation: fd.get(`ref${i}_occupation`) || "",
    address: fd.get(`ref${i}_address`) || "",
    phone: fd.get(`ref${i}_phone`) || "",
  }));

  const knownEmployees = [1, 2, 3].map((i) => ({
    name: fd.get(`knownEmp${i}_name`) || "",
    dept: fd.get(`knownEmp${i}_dept`) || "",
    relation: fd.get(`knownEmp${i}_relation`) || "",
  }));

  const emergencyContacts = [1, 2].map((i) => ({
    name: fd.get(`emg${i}_name`) || "",
    relation: fd.get(`emg${i}_relation`) || "",
    address: fd.get(`emg${i}_address`) || "",
    phone: fd.get(`emg${i}_phone`) || "",
  }));

  return {
    page1: {
      heardFrom: fd.get("heardFrom") || "",
      positionApplied: fd.get("positionApplied") || "",
      expectedSalary: fd.get("expectedSalary") || "",
      availableDate: fd.get("availableDate") || "",
      knowsEmployee: radioVal("knowsEmployee"),
      knownEmployees,
      nameTh: fd.get("nameTh") || "",
      nameEn: fd.get("nameEn") || "",
      ethnicity: fd.get("ethnicity") || "",
      nationality: fd.get("nationality") || "",
      religion: fd.get("religion") || "",
      birthDate: fd.get("birthDate") || "",
      age: fd.get("age") || "",
      weight: fd.get("weight") || "",
      height: fd.get("height") || "",
      idCardNo: fd.get("idCardNo") || "",
      idCardIssuedAt: fd.get("idCardIssuedAt") || "",
      idCardIssueDate: fd.get("idCardIssueDate") || "",
      idCardExpiry: fd.get("idCardExpiry") || "",
      photoData: fd.get("photoData") || "",
      regAddress: addressFrom("reg", fd),
      curAddress: addressFrom("cur", fd),
      livingType: radioVal("livingType"),
      livingOther: fd.get("livingOther") || "",
      father: {
        name: fd.get("fatherName") || "",
        age: fd.get("fatherAge") || "",
        nationality: fd.get("fatherNationality") || "",
        ethnicity: fd.get("fatherEthnicity") || "",
        alive: radioVal("fatherAlive"),
        occupation: fd.get("fatherOccupation") || "",
        workplace: fd.get("fatherWorkplace") || "",
      },
      mother: {
        name: fd.get("motherName") || "",
        age: fd.get("motherAge") || "",
        nationality: fd.get("motherNationality") || "",
        ethnicity: fd.get("motherEthnicity") || "",
        alive: radioVal("motherAlive"),
        occupation: fd.get("motherOccupation") || "",
        workplace: fd.get("motherWorkplace") || "",
      },
      siblings: {
        total: fd.get("siblingTotal") || "",
        male: fd.get("siblingMale") || "",
        female: fd.get("siblingFemale") || "",
        order: fd.get("siblingOrder") || "",
        list: collectDynamic(".sibling-item"),
      },
      emergencyContacts,
      smoking: radioVal("smoking"),
      smokingPerDay: fd.get("smokingPerDay") || "",
      chronicDisease: radioVal("chronicDisease"),
      chronicDiseaseDetail: fd.get("chronicDiseaseDetail") || "",
      seriousIllness: radioVal("seriousIllness"),
      seriousIllnessTimes: fd.get("seriousIllnessTimes") || "",
      seriousIllnessReason: fd.get("seriousIllnessReason") || "",
      legalCase: radioVal("legalCase"),
      legalCaseTimes: fd.get("legalCaseTimes") || "",
      legalCaseDetail: fd.get("legalCaseDetail") || "",
      consentAccepted: !!form.consentAccepted?.checked,
      signatureName: fd.get("signatureName") || "",
      signatureDate: fd.get("signatureDate") || "",
    },
    marital: {
      status: radioVal("maritalStatus"),
      marriedYear: fd.get("marriedYear") || "",
      registeredYear: fd.get("registeredYear") || "",
      notRegistered: !!form.notRegistered?.checked,
      spouse: {
        name: fd.get("spouseName") || "",
        age: fd.get("spouseAge") || "",
        nationality: fd.get("spouseNationality") || "",
        ethnicity: fd.get("spouseEthnicity") || "",
        alive: radioVal("spouseAlive"),
        occupation: fd.get("spouseOccupation") || "",
        workplace: fd.get("spouseWorkplace") || "",
        position: fd.get("spousePosition") || "",
      },
      childrenCount: count,
      children,
    },
    languages,
    skills: {
      computer: fd.get("computerSkills") || "",
      other: fd.get("otherSkills") || "",
    },
    military: {
      status: radioVal("militaryStatus"),
      year: fd.get("militaryYear") || "",
      exemptReason: fd.get("militaryExemptReason") || "",
    },
    education,
    vehicles: {
      hasCar: radioVal("hasCar"),
      carDetail: fd.get("carDetail") || "",
      hasCarLicense: radioVal("hasCarLicense"),
      carLicenseType: radioVal("carLicenseType"),
      carLicenseNo: fd.get("carLicenseNo") || "",
      hasMotorcycle: radioVal("hasMotorcycle"),
      motorcycleDetail: fd.get("motorcycleDetail") || "",
      hasMotorcycleLicense: radioVal("hasMotorcycleLicense"),
      motorcycleLicenseType: radioVal("motorcycleLicenseType"),
      motorcycleLicenseNo: fd.get("motorcycleLicenseNo") || "",
    },
    references,
    workHistory: collectDynamic(".work-item"),
    hobbies: fd.get("hobbies") || "",
    clubs: collectDynamic(".club-item"),
    trainings: collectDynamic(".train-item"),
  };
}

function toggleMarriedBlock() {
  const married = radioVal("maritalStatus") === "married";
  document.getElementById("married-block").hidden = !married;
}

function handlePhoto(file) {
  const preview = document.getElementById("photoPreview");
  const hidden = document.getElementById("photoData");
  const placeholder = document.getElementById("photoPlaceholder");
  const removeBtn = document.getElementById("photoRemove");
  if (!file) {
    hidden.value = "";
    preview.hidden = true;
    preview.removeAttribute("src");
    placeholder.hidden = false;
    removeBtn.hidden = true;
    return;
  }
  if (!file.type.startsWith("image/")) {
    toast("กรุณาเลือกไฟล์รูปภาพ", true);
    return;
  }
  if (file.size > 1.5 * 1024 * 1024) {
    toast("รูปถ่ายควรไม่เกิน 1.5 MB", true);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    hidden.value = reader.result;
    preview.src = reader.result;
    preview.hidden = false;
    placeholder.hidden = true;
    removeBtn.hidden = false;
  };
  reader.readAsDataURL(file);
}

async function openPreview() {
  const data = collectForm();
  const tab = window.open("", "_blank");
  if (!tab) {
    toast("เบราว์เซอร์บล็อกหน้าต่างตัวอย่าง กรุณาอนุญาต Pop-up", true);
    return;
  }
  tab.document.write("<title>กำลังสร้าง F06-005...</title><p style='font-family:sans-serif;padding:2rem'>กำลังสร้างตัวอย่างจากเอกสารต้นฉบับ...</p>");
  try {
    const response = await fetch("/api/f06/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error("preview failed");
    const pdf = await response.blob();
    tab.location.href = URL.createObjectURL(pdf);
  } catch {
    tab.close();
    toast("ไม่สามารถสร้างตัวอย่าง PDF ได้", true);
  }
}

function tryRestore() {
  const raw = sessionStorage.getItem("restoreData");
  if (!raw) return;
  sessionStorage.removeItem("restoreData");
  try {
    const data = JSON.parse(raw);
    populateForm(data);
    toast("กู้คืนข้อมูลจากตัวอย่างแล้ว");
  } catch {}
}

function populateForm(data) {
  const d = data || {};
  const p = d.page1 || {};
  const form = document.getElementById("application-form");
  const set = (name, v) => { const el = form.querySelector(`[name="${name}"]`); if (el) el.value = v ?? ""; };
  const setRadio = (name, v) => { const el = form.querySelector(`input[name="${name}"][value="${v}"]`); if (el) el.checked = true; };
  const setChk = (name, v) => { const el = form.querySelector(`[name="${name}"]`); if (el) el.checked = !!v; };

  set("heardFrom", p.heardFrom); set("positionApplied", p.positionApplied); set("expectedSalary", p.expectedSalary); set("availableDate", p.availableDate);
  setRadio("knowsEmployee", p.knowsEmployee);
  (p.knownEmployees || []).forEach((r, i) => { set(`knownEmp${i+1}_name`, r.name); set(`knownEmp${i+1}_dept`, r.dept); set(`knownEmp${i+1}_relation`, r.relation); });
  set("nameTh", p.nameTh); set("nameEn", p.nameEn); set("ethnicity", p.ethnicity); set("nationality", p.nationality); set("religion", p.religion);
  set("birthDate", p.birthDate); set("age", p.age); set("weight", p.weight); set("height", p.height);
  set("idCardNo", p.idCardNo); set("idCardIssuedAt", p.idCardIssuedAt); set("idCardIssueDate", p.idCardIssueDate); set("idCardExpiry", p.idCardExpiry);
  if (p.photoData) { document.getElementById("photoData").value = p.photoData; const pv = document.getElementById("photoPreview"); pv.src = p.photoData; pv.hidden = false; document.getElementById("photoPlaceholder").hidden = true; document.getElementById("photoRemove").hidden = false; }
  const a = (pre, obj) => { if (!obj) return; set(`${pre}HouseNo`, obj.houseNo); set(`${pre}Moo`, obj.moo); set(`${pre}Village`, obj.village); set(`${pre}Soi`, obj.soi); set(`${pre}Road`, obj.road); set(`${pre}Tambon`, obj.tambon); set(`${pre}Amphoe`, obj.amphoe); set(`${pre}Province`, obj.province); set(`${pre}Zip`, obj.zip); set(`${pre}Phone`, obj.phone); };
  a("reg", p.regAddress); a("cur", p.curAddress);
  setRadio("livingType", p.livingType); set("livingOther", p.livingOther);
  const f = p.father || {}, m = p.mother || {};
  set("fatherName", f.name); set("fatherAge", f.age); set("fatherNationality", f.nationality); set("fatherEthnicity", f.ethnicity); setRadio("fatherAlive", f.alive); set("fatherOccupation", f.occupation); set("fatherWorkplace", f.workplace);
  set("motherName", m.name); set("motherAge", m.age); set("motherNationality", m.nationality); set("motherEthnicity", m.ethnicity); setRadio("motherAlive", m.alive); set("motherOccupation", m.occupation); set("motherWorkplace", m.workplace);
  set("siblingTotal", p.siblings?.total); set("siblingMale", p.siblings?.male); set("siblingFemale", p.siblings?.female); set("siblingOrder", p.siblings?.order);
  document.getElementById("sibling-list").innerHTML = "";
  (p.siblings?.list || []).forEach((s) => addSibling(s));
  (p.emergencyContacts || []).forEach((r, i) => { set(`emg${i+1}_name`, r.name); set(`emg${i+1}_relation`, r.relation); set(`emg${i+1}_address`, r.address); set(`emg${i+1}_phone`, r.phone); });
  setRadio("smoking", p.smoking); set("smokingPerDay", p.smokingPerDay);
  setRadio("chronicDisease", p.chronicDisease); set("chronicDiseaseDetail", p.chronicDiseaseDetail);
  setRadio("seriousIllness", p.seriousIllness); set("seriousIllnessTimes", p.seriousIllnessTimes); set("seriousIllnessReason", p.seriousIllnessReason);
  setRadio("legalCase", p.legalCase); set("legalCaseTimes", p.legalCaseTimes); set("legalCaseDetail", p.legalCaseDetail);
  setChk("consentAccepted", p.consentAccepted); set("signatureName", p.signatureName); set("signatureDate", p.signatureDate);

  const m2 = d.marital || {}, sp = m2.spouse || {};
  setRadio("maritalStatus", m2.status); set("marriedYear", m2.marriedYear); set("registeredYear", m2.registeredYear); setChk("notRegistered", m2.notRegistered);
  set("spouseName", sp.name); set("spouseAge", sp.age); set("spouseNationality", sp.nationality); set("spouseEthnicity", sp.ethnicity); setRadio("spouseAlive", sp.alive); set("spouseOccupation", sp.occupation); set("spouseWorkplace", sp.workplace); set("spousePosition", sp.position);
  set("childrenCount", m2.childrenCount); renderChildrenRows(m2.childrenCount || 0); (m2.children || []).forEach((c, i) => { set(`child${i+1}_gender`, c.gender); set(`child${i+1}_birthYear`, c.birthYear); });
  const lang = d.languages || {};
  ["english","chinese","japanese","other"].forEach(k => { const r = lang[k]||{}; set(`lang_${k}_speak`, r.speak); set(`lang_${k}_write`, r.write); set(`lang_${k}_read`, r.read); set(`lang_${k}_listen`, r.listen); if (k==="other") set("lang_other_name", r.name); });
  set("computerSkills", d.skills?.computer); set("otherSkills", d.skills?.other);
  setRadio("militaryStatus", d.military?.status); set("militaryYear", d.military?.year); set("militaryExemptReason", d.military?.exemptReason);
  (d.education || []).forEach(e => { const k = e.level; set(`edu_${k}_school`, e.school); set(`edu_${k}_from`, e.from); set(`edu_${k}_to`, e.to); set(`edu_${k}_degree`, e.degree); set(`edu_${k}_major`, e.major); set(`edu_${k}_gpa`, e.gpa); if (k==="other") set("edu_other_level", e.otherLevel); });
  const v = d.vehicles || {};
  setRadio("hasCar", v.hasCar); set("carDetail", v.carDetail); setRadio("hasCarLicense", v.hasCarLicense); setRadio("carLicenseType", v.carLicenseType); set("carLicenseNo", v.carLicenseNo);
  setRadio("hasMotorcycle", v.hasMotorcycle); set("motorcycleDetail", v.motorcycleDetail); setRadio("hasMotorcycleLicense", v.hasMotorcycleLicense); setRadio("motorcycleLicenseType", v.motorcycleLicenseType); set("motorcycleLicenseNo", v.motorcycleLicenseNo);
  (d.references || []).forEach((r, i) => { set(`ref${i+1}_name`, r.name); set(`ref${i+1}_relation`, r.relation); set(`ref${i+1}_occupation`, r.occupation); set(`ref${i+1}_address`, r.address); set(`ref${i+1}_phone`, r.phone); });
  document.getElementById("work-list").innerHTML = ""; (d.workHistory || []).forEach(w => addWork(w));
  set("hobbies", d.hobbies);
  document.getElementById("club-list").innerHTML = ""; (d.clubs || []).forEach(c => addClub(c));
  document.getElementById("train-list").innerHTML = ""; (d.trainings || []).forEach(t => addTrain(t));

  toggleMarriedBlock();
  updateProgress();
}

async function saveApplication(e) {
  e.preventDefault();
  const data = collectForm();
  const btn = document.getElementById("btn-save");
  btn.disabled = true;
  try {
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("บันทึกไม่สำเร็จ");
    const record = await res.json();
    toast("บันทึกใบสมัครสำเร็จ");
    setTimeout(() => {
      window.location.href = `/hr/view.html?id=${record.id}`;
    }, 600);
  } catch (err) {
    toast(err.message || "เกิดข้อผิดพลาด", true);
  } finally {
    btn.disabled = false;
  }
}

function resetForm() {
  document.getElementById("application-form").reset();
  document.getElementById("work-list").innerHTML = "";
  document.getElementById("club-list").innerHTML = "";
  document.getElementById("train-list").innerHTML = "";
  document.getElementById("sibling-list").innerHTML = "";
  document.getElementById("photoData").value = "";
  const preview = document.getElementById("photoPreview");
  preview.hidden = true;
  preview.removeAttribute("src");
  renderChildrenRows(0);
  addWork();
  addClub();
  addTrain();
  addSibling();
  toggleMarriedBlock();
  updateProgress();
}

document.addEventListener("DOMContentLoaded", () => {
  fillLangSelects();
  renderChildrenRows(0);
  addWork();
  addClub();
  addTrain();
  addSibling();

  document.getElementById("childrenCount").addEventListener("change", (e) => {
    renderChildrenRows(e.target.value);
  });

  document.querySelectorAll('input[name="maritalStatus"]').forEach((el) => {
    el.addEventListener("change", toggleMarriedBlock);
  });

  document.getElementById("photoFile").addEventListener("change", (e) => {
    handlePhoto(e.target.files?.[0]);
  });
  const drop = document.getElementById("photoDrop");
  const wrap = document.getElementById("photoWrap");
  if (wrap) {
    wrap.addEventListener("click", () => document.getElementById("photoFile").click());
    ["dragenter", "dragover"].forEach(ev => wrap.addEventListener(ev, (e) => { e.preventDefault(); wrap.classList.add("dragover"); }));
    ["dragleave", "drop"].forEach(ev => wrap.addEventListener(ev, (e) => { e.preventDefault(); wrap.classList.remove("dragover"); }));
    wrap.addEventListener("drop", (e) => { const f = e.dataTransfer?.files?.[0]; if (f) handlePhoto(f); });
  }
  document.getElementById("photoRemove").addEventListener("click", (e) => { e.stopPropagation(); document.getElementById("photoFile").value = ""; handlePhoto(null); });

  document.getElementById("add-work").addEventListener("click", () => addWork());
  document.getElementById("add-club").addEventListener("click", () => addClub());
  document.getElementById("add-train").addEventListener("click", () => addTrain());
  document.getElementById("add-sibling").addEventListener("click", () => addSibling());
  document.getElementById("btn-reset").addEventListener("click", () => {
    if (confirm("ล้างข้อมูลทั้งหมดในฟอร์ม?")) resetForm();
  });
  document.getElementById("btn-preview").addEventListener("click", openPreview);
  document.getElementById("application-form").addEventListener("submit", saveApplication);

  const form = document.getElementById("application-form");
  form.addEventListener("input", updateProgress);
  form.addEventListener("change", updateProgress);
  tryRestore();
  updateProgress();
});
