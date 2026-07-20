'use strict';

const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');

const INK = rgb(0.02, 0.1, 0.35);
// ยกข้อความที่กรอกทั้งหมดให้ลอยเหนือเส้นเล็กน้อย (หน่วย pt, เพิ่มค่า = สูงขึ้น)
const LIFT = 1.5;
const WHITE = rgb(1, 1, 1);
const SAMPLE_FILL = rgb(0.94, 0.95, 0.96);
const SAMPLE_ACCENT = rgb(0.82, 0.85, 0.88);

function firstExisting(candidates) {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function assetPath(subdir, name) {
  const found = firstExisting([
    path.join(process.cwd(), subdir, name),
    path.join(__dirname, '..', subdir, name),
    path.join(__dirname, subdir, name),
    path.join('/var/task', subdir, name),
  ]);
  if (!found) {
    throw new Error(`ไม่พบไฟล์ ${subdir}/${name}`);
  }
  return found;
}

function obj(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function get(item, key) {
  return text(obj(item)[key]);
}

function isThaiCombining(codePoint) {
  return (
    codePoint === 0x0E31 ||
    codePoint === 0x0E33 ||
    (codePoint >= 0x0E34 && codePoint <= 0x0E3A) ||
    (codePoint >= 0x0E47 && codePoint <= 0x0E4E)
  );
}

function measureThaiText(content, font, size) {
  let width = 0;
  for (const char of content) {
    const codePoint = char.codePointAt(0);
    if (!isThaiCombining(codePoint)) {
      width += font.widthOfTextAtSize(char, size);
    }
  }
  return width;
}

function drawThaiText(page, content, x, y, size, font, color) {
  let cursor = x;
  for (const char of content) {
    const codePoint = char.codePointAt(0);
    page.drawText(char, { x: cursor, y, size, font, color });
    if (!isThaiCombining(codePoint)) {
      cursor += font.widthOfTextAtSize(char, size);
    }
  }
}

// baseline จริงของเส้นจุดไข่ปลาทุกเส้น ดึงจาก template ด้วย PyMuPDF (ดู scripts/extract-line-baselines.py)
const LINE_BASELINES = require('./line-baselines.json');
// ระยะสูงสุดที่ยอมให้ snap เข้าเส้น — น้อยกว่าครึ่งหนึ่งของระยะห่างระหว่างบรรทัด
const SNAP_TOLERANCE = 7;

// หา baseline ของเส้นจุดที่ตรงกับช่อง (x ต้องคาบเกี่ยว, y ต้องใกล้กว่า tolerance)
function snapToLine(lines, x0, x1, guess) {
  let best = null;
  let bestDist = SNAP_TOLERANCE;
  for (const line of lines) {
    if (x1 < line.x0 - 5 || x0 > line.x1 + 5) continue;
    const dist = Math.abs(line.y - guess);
    if (dist < bestDist) {
      bestDist = dist;
      best = line.y;
    }
  }
  return best;
}

function createPainter(page, height, fontRegular, fontBold, lines = []) {
  function put(box, content, size = 10, align = 0, bold = false, erase = true, dy = 0) {
    content = text(content);
    if (!content) return;
    const [x0, y0, x1, y1] = box;
    const width = x1 - x0;
    const rectHeight = y1 - y0;
    const font = bold ? fontBold : fontRegular;
    let current = size + 1;
    while (current > 4 && measureThaiText(content, font, current) > width - 2) {
      current -= 0.5;
    }
    const textWidth = measureThaiText(content, font, current);
    let x;
    if (align === 1) {
      x = x0 + Math.max(1, (width - textWidth) / 2);
    } else if (align === 2) {
      x = x1 - textWidth - 1;
    } else {
      x = x0 + 1;
    }
    let baseline;
    let lift;
    if (erase) {
      // ช่องจุดไข่ปลา: เกาะ baseline จริงของเส้นใน template (ถ้าหาไม่เจอค่อยใช้สูตรเดิม)
      const guess = y1 - 6.4;
      const snapped = snapToLine(lines, x0, x1, guess);
      baseline = (snapped === null ? guess : snapped) + dy;
      lift = LIFT;
    } else {
      // ช่องในตาราง: จัดกึ่งกลางแนวตั้งในเซลล์ — ไม่ยก LIFT เพราะไม่ได้อยู่บนเส้น
      baseline = y0 + rectHeight / 2 + current * 0.34 + dy;
      lift = 0;
    }
    drawThaiText(page, content, x, height - baseline + lift, current, font, INK);
  }

  // วางข้อความโดยกำหนด baseline (พิกัด top-down) ตรงจาก template โดยตรง
  // ใช้กับช่องจุดไข่ปลาที่วัด origin จุดจริงมาแล้ว ไม่พึ่งสูตร y1-6.4 ที่เปราะ
  function putOnLine(box, content, size, align, baselineY) {
    content = text(content);
    if (!content) return;
    const [x0, , x1] = box;
    const width = x1 - x0;
    const font = fontRegular;
    let current = size + 1;
    while (current > 4 && measureThaiText(content, font, current) > width - 2) {
      current -= 0.5;
    }
    const textWidth = measureThaiText(content, font, current);
    let x;
    if (align === 1) {
      x = x0 + Math.max(1, (width - textWidth) / 2);
    } else if (align === 2) {
      x = x1 - textWidth - 1;
    } else {
      x = x0 + 1;
    }
    drawThaiText(page, content, x, height - baselineY + LIFT, current, font, INK);
  }

  function mark(x, y, selected) {
    if (!selected) return;
    const rx0 = x + 2.0;
    const ry0 = y + 4.0;
    const rx1 = x + 9.0;
    const ry1 = y + 12.0;
    page.drawLine({
      start: { x: rx0, y: height - ry0 },
      end: { x: rx1, y: height - ry1 },
      thickness: 1.3,
      color: INK,
    });
    page.drawLine({
      start: { x: rx0, y: height - ry1 },
      end: { x: rx1, y: height - ry0 },
      thickness: 1.3,
      color: INK,
    });
  }

  function markValue(value, positions) {
    for (const [expected, x, y] of positions) {
      mark(x, y, value === expected);
    }
  }

  return { put, putOnLine, mark, markValue };
}

async function placePhoto(pdfDoc, page, height, dataUrl) {
  const target = { x0: 1064, y0: 291, x1: 1164, y1: 425 };
  const tW = target.x1 - target.x0;
  const tH = target.y1 - target.y0;

  if (dataUrl === '__SAMPLE__') {
    page.drawRectangle({ x: target.x0, y: height - target.y1, width: tW, height: tH, color: SAMPLE_FILL });
    page.drawEllipse({ x: 1114, y: height - 330, xScale: 18, yScale: 18, color: SAMPLE_ACCENT, borderColor: INK, borderWidth: 1 });
    return;
  }
  if (!dataUrl || !dataUrl.includes(',')) return;

  try {
    const base64 = dataUrl.split(',', 2)[1];
    const bytes = Buffer.from(base64, 'base64');
    const isPng = /^data:image\/png/i.test(dataUrl);
    const image = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
    page.drawRectangle({ x: target.x0, y: height - target.y1, width: tW, height: tH, color: WHITE });
    const ratio = Math.min(tW / image.width, tH / image.height);
    const w = image.width * ratio;
    const h = image.height * ratio;
    const ax0 = target.x0 + (tW - w) / 2;
    const topY = target.y0 + (tH - h) / 2;
    page.drawImage(image, { x: ax0, y: height - (topY + h), width: w, height: h });
  } catch (err) {
    // Ignore malformed image data, leave the photo box empty.
  }
}

async function fillPage1(pdfDoc, page, height, fontRegular, fontBold, data) {
  const { put, putOnLine, mark, markValue } = createPainter(page, height, fontRegular, fontBold, LINE_BASELINES.page1);
  const p = obj(data.page1);

  const contacts = arr(p.emergencyContacts);
  [60, 101].forEach((y, index) => {
    if (index >= contacts.length) return;
    const item = obj(contacts[index]);
    put([100, y, 345, y + 15], get(item, 'name'), 9);
    put([430, y, 565, y + 15], get(item, 'relation'), 9);
    put([55, y + 20, 400, y + 36], get(item, 'address'), 8);
    put([470, y + 20, 565, y + 36], get(item, 'phone'), 9);
  });

  put([145, 168, 565, 184], get(p, 'heardFrom'), 9);
  markValue(get(p, 'knowsEmployee'), [['no', 268.9, 185.4], ['yes', 318.3, 185.4]]);
  [209, 229, 250].forEach((y, index) => {
    const known = arr(p.knownEmployees);
    if (index >= known.length) return;
    const item = obj(known[index]);
    put([100, y, 290, y + 16], get(item, 'name'), 8);
    put([375, y, 465, y + 16], get(item, 'dept') || get(item, 'department'), 8);
    put([505, y, 566, y + 16], get(item, 'relation'), 8);
  });

  markValue(get(p, 'smoking'), [['no', 94.1, 269.8], ['yes', 134.7, 269.8]]);
  put([186, 278, 223, 291], get(p, 'smokingPerDay'), 8, 1);
  markValue(get(p, 'chronicDisease'), [['no', 170.2, 290.1], ['yes', 205.2, 290.1]]);
  put([260, 290, 560, 307], get(p, 'chronicDiseaseDetail'), 8);
  markValue(get(p, 'seriousIllness'), [['never', 19.6, 329.8], ['yes', 62.4, 329.8]]);
  put([94, 338, 138, 351], get(p, 'seriousIllnessTimes'), 8, 1);
  put([220, 330, 560, 347], get(p, 'seriousIllnessReason'), 8);
  markValue(get(p, 'legalCase'), [['never', 214.2, 349.6], ['yes', 257.2, 349.6]]);
  put([302, 350, 342, 367], get(p, 'legalCaseTimes'), 9, 1);
  put([120, 373, 565, 388], get(p, 'legalCaseDetail'), 8);
  put([74, 582, 264, 597], get(p, 'signatureName'), 10, 1);
  put([430, 559, 547, 574], get(p, 'signatureDate'), 8, 1);

  put([760, 175, 1145, 192], get(p, 'positionApplied'), 11, 0, false);
  put([760, 204, 910, 220], get(p, 'expectedSalary'), 10, 1);
  put([1012, 204, 1138, 220], get(p, 'availableDate'), 9, 1);
  put([770, 265, 1055, 280], get(p, 'nameTh'), 11, 0, false);
  put([780, 291, 1065, 307], get(p, 'nameEn'), 10);
  put([666, 312, 765, 327], get(p, 'ethnicity'), 9, 1);
  put([798, 312, 886, 327], get(p, 'nationality'), 9, 1);
  put([918, 312, 1053, 327], get(p, 'religion'), 9, 1);
  put([699, 332, 780, 347], get(p, 'birthDate'), 9, 1);
  put([800, 332, 839, 347], get(p, 'age'), 9, 1);
  put([881, 332, 937, 347], get(p, 'weight'), 9, 1);
  put([984, 332, 1038, 347], get(p, 'height'), 9, 1);
  put([707, 352, 849, 367], get(p, 'idCardNo'), 9, 1);
  put([936, 352, 1055, 367], get(p, 'idCardIssuedAt'), 8, 1);
  put([685, 372, 850, 388], get(p, 'idCardIssueDate'), 9, 1);
  put([898, 372, 1054, 388], get(p, 'idCardExpiry'), 9, 1);
  await placePhoto(pdfDoc, page, height, get(p, 'photoData'));

  // ที่อยู่: ตรึง baseline ไว้ที่ origin ของเส้นจุดจริงที่วัดจาก template ด้วย PyMuPDF
  // (FreesiaUPC 12.96pt) แทนสูตร y1-6.4 เพื่อให้ข้อความอยู่บนเส้นแบบแม่นยำทุกแถว
  const registered = obj(p.regAddress);
  putOnLine([760, 392, 820, 407], get(registered, 'houseNo'), 9, 1,400.61);
  putOnLine([840, 392, 874, 407], get(registered, 'moo'), 9, 1,400.61);
  putOnLine([908, 392, 1014, 407], get(registered, 'village'), 9, 0,400.61);
  putOnLine([700, 412, 815, 427], get(registered, 'soi'), 9, 1,421.01);
  putOnLine([865, 412, 980, 427], get(registered, 'road'), 9, 1,421.01);
  putOnLine([715, 435, 825, 450], get(registered, 'tambon'), 9, 1,443.45);
  putOnLine([875, 435, 985, 450], get(registered, 'amphoe'), 9, 1,443.45);
  putOnLine([1040, 435, 1158, 450], get(registered, 'province'), 9, 1,443.45);
  putOnLine([710, 455, 800, 470], get(registered, 'zip'), 9, 1,463.85);
  putOnLine([875, 455, 975, 470], get(registered, 'phone'), 9, 1,463.85);

  const current = obj(p.curAddress);
  putOnLine([754, 475, 817, 491], get(current, 'houseNo'), 9, 1,484.27);
  putOnLine([840, 475, 874, 491], get(current, 'moo'), 9, 1,484.27);
  putOnLine([908, 475, 1014, 491], get(current, 'village'), 9, 0,484.27);
  putOnLine([1060, 475, 1157, 491], get(current, 'soi'), 9, 0,484.27);
  putOnLine([685, 496, 800, 511], get(current, 'road'), 9, 1,504.55);
  putOnLine([850, 496, 970, 511], get(current, 'tambon'), 9, 1,504.55);
  putOnLine([1050, 496, 1158, 511], get(current, 'amphoe'), 9, 1,504.55);
  putOnLine([700, 516, 820, 531], get(current, 'province'), 9, 1,524.95);
  putOnLine([895, 516, 970, 531], get(current, 'zip'), 9, 1,524.95);
  putOnLine([1050, 516, 1158, 531], get(current, 'phone'), 9, 1,524.95);
  markValue(get(p, 'livingType'), [
    ['dorm', 698.2, 531.8],
    ['rent', 740.7, 531.8],
    ['own', 789.4, 531.8],
    ['parents', 847.9, 531.8],
    ['other', 930.1, 531.8],
  ]);
  put([1015, 532, 1158, 550], get(p, 'livingOther'), 8);

  const father = obj(p.father);
  put([715, 556, 918, 570], get(father, 'name'), 9, 1);
  put([938, 556, 1003, 570], get(father, 'age'), 8, 1);
  put([1036, 556, 1081, 570], get(father, 'nationality'), 8, 1);
  put([1115, 556, 1160, 570], get(father, 'ethnicity'), 8, 1);
  markValue(get(father, 'alive'), [['alive', 634.5, 572.5], ['dead', 1090.0, 572.5]]);
  put([730, 573, 830, 590], get(father, 'occupation'), 8, 1);
  put([900, 573, 1085, 590], get(father, 'workplace'), 8, 1);

  const mother = obj(p.mother);
  put([724, 597, 918, 611], get(mother, 'name'), 9, 1);
  put([938, 597, 1003, 611], get(mother, 'age'), 8, 1);
  put([1036, 597, 1081, 611], get(mother, 'nationality'), 8, 1);
  put([1115, 597, 1160, 611], get(mother, 'ethnicity'), 8, 1);
  markValue(get(mother, 'alive'), [['alive', 634.5, 612.7], ['dead', 1090.0, 612.7]]);
  put([730, 613, 830, 630], get(mother, 'occupation'), 8, 1);
  put([900, 613, 1085, 630], get(mother, 'workplace'), 8, 1);

  const siblings = obj(p.siblings);
  put([737, 637, 795, 652], get(siblings, 'total'), 8, 1);
  put([830, 637, 891, 652], get(siblings, 'male'), 8, 1);
  put([928, 637, 998, 652], get(siblings, 'female'), 8, 1);
  put([1062, 637, 1114, 652], get(siblings, 'order'), 8, 1);
  const siblingRows = arr(siblings.list);
  const siblingTops = [672, 692.2, 712.5, 732.8, 753.2, 773.6];
  const siblingBottoms = [692.1, 712.5, 732.8, 753.2, 773.6, 793.9];
  siblingTops.forEach((y, index) => {
    if (index >= siblingRows.length) return;
    const item = obj(siblingRows[index]);
    const rowBottom = siblingBottoms[index];
    const fields = [
      [[636, y, 677, rowBottom], String(index + 1)],
      [[680, y, 835, rowBottom], get(item, 'name')],
      [[837, y, 884, rowBottom], get(item, 'age')],
      [[886, y, 963, rowBottom], get(item, 'occupation')],
      [[965, y, 1084, rowBottom], get(item, 'workplace')],
      [[1086, y, 1159, rowBottom], get(item, 'position')],
    ];
    for (const [box, content] of fields) {
      put(box, content, 7, 1, false, false);
    }
  });
}

function fillPage2(page, height, fontRegular, fontBold, data) {
  const { put, mark, markValue } = createPainter(page, height, fontRegular, fontBold, LINE_BASELINES.page2);

  const marital = obj(data.marital);
  const spouse = obj(marital.spouse);
  const status = get(marital, 'status');
  markValue(status, [
    ['single', 71.8, 40.2],
    ['widowed', 105.7, 40.2],
    ['divorced', 147.0, 40.2],
    ['married', 141.5, 63.5],
  ]);
  mark(70.3, 63.5, status === 'married');
  put([208, 64, 255, 81], get(marital, 'marriedYear'), 9, 1);
  mark(271.9, 63.5, Boolean(get(marital, 'registeredYear')));
  put([390, 64, 430, 81], get(marital, 'registeredYear'), 9, 1);
  mark(443.2, 63.5, Boolean(marital.notRegistered));
  put([165, 88, 328, 104], get(spouse, 'name'), 9, 1);
  put([348, 88, 382, 104], get(spouse, 'age'), 8, 1);
  put([424, 88, 467, 104], get(spouse, 'nationality'), 8, 1);
  put([501, 88, 544, 104], get(spouse, 'ethnicity'), 8, 1);
  markValue(get(spouse, 'alive'), [['alive', 19.8, 109.8], ['dead', 498.4, 109.8]]);
  put([101, 110, 189, 127], get(spouse, 'occupation'), 8, 1);
  put([246, 110, 355, 127], get(spouse, 'workplace'), 8, 1);
  put([391, 110, 493, 127], get(spouse, 'position'), 8, 1);
  put([62, 135, 94, 151], get(marital, 'childrenCount'), 8, 1);
  arr(marital.children).slice(0, 6).forEach((child, index) => {
    const genderX = [162, 309, 453, 162, 309, 453][index];
    const yearX = [228, 375, 520, 228, 375, 520][index];
    const y = index < 3 ? 135 : 158;
    put([genderX, y, genderX + 40, y + 17], get(child, 'gender'), 8, 1);
    put([yearX, y, yearX + 45, y + 17], get(child, 'birthYear'), 8, 1);
  });

  const military = obj(data.military);
  markValue(get(military, 'status'), [
    ['served', 19.8, 202.7],
    ['upcoming', 97.0, 202.7],
    ['exempt', 260.2, 202.7],
  ]);
  put([205, 203, 250, 220], get(military, 'year'), 9, 1);
  put([365, 203, 565, 220], get(military, 'exemptReason'), 8);

  const languages = obj(data.languages);
  const langRows = [['english', 58], ['chinese', 81], ['japanese', 104], ['other', 127]];
  const langColumns = [['speak', 820, 906], ['write', 906, 992], ['read', 992, 1078], ['listen', 1078, 1161]];
  for (const [key, y] of langRows) {
    const item = obj(languages[key]);
    if (key === 'other') {
      put([670, y, 810, y + 22], get(item, 'name'), 8, 1);
    }
    for (const [field, x0, x1] of langColumns) {
      put([x0, y, x1, y + 22], get(item, field), 8, 1, false, false);
    }
  }

  const skills = obj(data.skills);
  mark(634.9, 179.4, Boolean(get(skills, 'computer')));
  put([790, 180, 1145, 197], get(skills, 'computer'), 8);
  mark(634.9, 202.7, Boolean(get(skills, 'other')));
  put([800, 203, 1145, 220], get(skills, 'other'), 8);

  const levelRows = {
    primary: 292.6,
    m1: 315.8,
    m2: 339.0,
    vocational: 339.0,
    diploma: 362.2,
    bachelor: 385.4,
    master: 408.6,
    other: 431.8,
  };
  const used = new Set();
  arr(data.education).forEach((raw, index) => {
    const item = obj(raw);
    let y = levelRows[get(item, 'level')];
    if (y === undefined) y = 292.6 + index * 23.2;
    while (used.has(y) && y <= 431.8) {
      y = Math.round((y + 23.2) * 10) / 10;
    }
    if (y > 431.8) return;
    used.add(y);
    if (get(item, 'level') === 'other') {
      put([20, y, 105, y + 23.2], get(item, 'otherLevel'), 7, 1);
    }
    const fields = [
      [[108, y, 283, y + 23.2], get(item, 'school')],
      [[287, y, 338, y + 23.2], get(item, 'from')],
      [[342, y, 393, y + 23.2], get(item, 'to')],
      [[397, y, 452, y + 23.2], get(item, 'degree')],
      [[455, y, 530, y + 23.2], get(item, 'major')],
      [[533, y, 586, y + 23.2], get(item, 'gpa')],
    ];
    for (const [box, content] of fields) {
      put(box, content, 7, 1, false, false);
    }
  });

  const vehicle = obj(data.vehicles);
  markValue(get(vehicle, 'hasCar'), [['no', 736.6, 272.3], ['yes', 774.5, 272.3]]);
  put([905, 273, 1148, 290], get(vehicle, 'carDetail'), 8);
  markValue(get(vehicle, 'hasCarLicense'), [['no', 691.8, 295.5], ['yes', 730.4, 295.5]]);
  markValue(get(vehicle, 'carLicenseType'), [['yearly', 816.1, 295.5], ['lifetime', 855.9, 295.5]]);
  put([990, 296, 1148, 313], get(vehicle, 'carLicenseNo'), 8);
  markValue(get(vehicle, 'hasMotorcycle'), [['no', 766.9, 318.6], ['yes', 804.8, 318.6]]);
  put([930, 319, 1148, 336], get(vehicle, 'motorcycleDetail'), 8);
  markValue(get(vehicle, 'hasMotorcycleLicense'), [['no', 722.1, 341.9], ['yes', 760.0, 341.9]]);
  markValue(get(vehicle, 'motorcycleLicenseType'), [['yearly', 845.6, 341.9], ['lifetime', 885.6, 341.9]]);
  put([1010, 342, 1148, 359], get(vehicle, 'motorcycleLicenseNo'), 8);

  arr(data.references).slice(0, 2).forEach((raw, index) => {
    const item = obj(raw);
    const y = 408.6 + index * 23.2;
    const fields = [
      [[635, y, 669, y + 23.2], String(index + 1)],
      [[672, y, 809, y + 23.2], get(item, 'name')],
      [[812, y, 875, y + 23.2], get(item, 'relation')],
      [[878, y, 950, y + 23.2], get(item, 'occupation')],
      [[953, y, 1095, y + 23.2], get(item, 'address')],
      [[1098, y, 1160, y + 23.2], get(item, 'phone')],
    ];
    for (const [box, content] of fields) {
      put(box, content, 6.5, 1, false, false);
    }
  });

  arr(data.workHistory).slice(0, 7).forEach((raw, index) => {
    const item = obj(raw);
    const y = 535.1 + index * 23.2;
    const fields = [
      [[20, y, 82, y + 22], get(item, 'fromDate')],
      [[85, y, 145, y + 22], get(item, 'toDate')],
      [[148, y, 301, y + 22], get(item, 'company')],
      [[304, y, 379, y + 22], get(item, 'businessType')],
      [[382, y, 464, y + 22], get(item, 'startPosition')],
      [[468, y, 549, y + 22], get(item, 'endPosition')],
      [[553, y, 790, y + 22], get(item, 'responsibilities')],
      [[793, y, 870, y + 22], get(item, 'salaryStart')],
      [[873, y, 946, y + 22], get(item, 'salaryEnd')],
      [[950, y, 1160, y + 22], get(item, 'leaveReason')],
    ];
    for (const [box, content] of fields) {
      put(box, content, 6, 1, false, false);
    }
  });

  const hobbies = text(data.hobbies)
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  hobbies.slice(0, 3).forEach((hobby, index) => {
    const y = 743.9 + index * 23.25;
    put([15, y, 207, y + 23.25], hobby, 7, 1, false, false);
  });
  arr(data.clubs).slice(0, 3).forEach((raw, index) => {
    const item = obj(raw);
    const y = 743.9 + index * 23.25;
    put([207, y, 400, y + 23.15], get(item, 'name'), 7, 1, false, false);
    put([400, y, 581, y + 23.15], get(item, 'position'), 7, 1, false, false);
  });
  arr(data.trainings).slice(0, 2).forEach((raw, index) => {
    const item = obj(raw);
    const y = 767.2 + index * 23.15;
    put([629, y, 679, y + 23.15], get(item, 'from'), 7, 1, false, false);
    put([679, y, 728, y + 23.15], get(item, 'to'), 7, 1, false, false);
    put([728, y, 955, y + 23.15], get(item, 'course'), 7, 1, false, false);
    put([955, y, 1161, y + 23.15], get(item, 'institute'), 7, 1, false, false);
  });
}

async function generateF06Pdf(record) {
  const data = record && record.data ? obj(record.data) : obj(record);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // ใช้ Sarabun เป็นฟอนต์หลัก (license OFL, tracked, มีบน Netlify แน่นอน)
  // baseline ของช่องที่อยู่ถูกตรึงด้วย putOnLine จาก origin จุดจริง จึงอยู่บนเส้นทุกฟอนต์
  const regularPath = firstExisting([
    path.join(process.cwd(), 'fonts', 'Sarabun-Regular.ttf'),
    path.join(__dirname, '..', 'fonts', 'Sarabun-Regular.ttf'),
  ]);
  const boldPath = firstExisting([
    path.join(process.cwd(), 'fonts', 'Sarabun-Bold.ttf'),
    path.join(__dirname, '..', 'fonts', 'Sarabun-Bold.ttf'),
  ]);
  if (!regularPath || !boldPath) {
    throw new Error('ไม่พบฟอนต์ Sarabun');
  }
  const fontRegular = await pdfDoc.embedFont(fs.readFileSync(regularPath));
  const fontBold = await pdfDoc.embedFont(fs.readFileSync(boldPath));

  const tpl1Bytes = fs.readFileSync(assetPath('templates', 'F06-005-page1.pdf'));
  const tpl2Bytes = fs.readFileSync(assetPath('templates', 'F06-005-page2.pdf'));
  const [embedded1] = await pdfDoc.embedPdf(tpl1Bytes, [0]);
  const [embedded2] = await pdfDoc.embedPdf(tpl2Bytes, [0]);

  const page1 = pdfDoc.addPage([embedded1.width, embedded1.height]);
  page1.drawPage(embedded1, { x: 0, y: 0, width: embedded1.width, height: embedded1.height });
  const page2 = pdfDoc.addPage([embedded2.width, embedded2.height]);
  page2.drawPage(embedded2, { x: 0, y: 0, width: embedded2.width, height: embedded2.height });

  await fillPage1(pdfDoc, page1, embedded1.height, fontRegular, fontBold, data);
  fillPage2(page2, embedded2.height, fontRegular, fontBold, data);

  const applicant = get(obj(data.page1), 'nameTh');
  pdfDoc.setTitle('F06-005 Rev.2 ใบสมัครงาน');
  if (applicant) {
    pdfDoc.setSubject(applicant);
    pdfDoc.setAuthor(applicant);
  }
  pdfDoc.setCreator('HRregister');

  return pdfDoc.save();
}

module.exports = { generateF06Pdf };
