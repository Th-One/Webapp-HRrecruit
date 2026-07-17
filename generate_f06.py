"""Create a filled F06-005 PDF by drawing only on the original PDF pages."""

from __future__ import annotations

import argparse
import base64
import json
import re
from io import BytesIO
from pathlib import Path

import fitz


ROOT = Path(__file__).resolve().parent
PAGE1_TEMPLATE = ROOT / "templates" / "F06-005-page1.pdf"
PAGE2_TEMPLATE = ROOT / "templates" / "F06-005-page2.pdf"
FONT_REGULAR = Path(r"C:\Windows\Fonts\upcfl.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\upcfb.ttf")
FONT_REGULAR_OBJ = fitz.Font(fontfile=str(FONT_REGULAR))
FONT_BOLD_OBJ = fitz.Font(fontfile=str(FONT_BOLD))
INK = (0.02, 0.10, 0.35)


def obj(value):
    return value if isinstance(value, dict) else {}


def arr(value):
    return value if isinstance(value, list) else []


def text(value):
    return "" if value is None else str(value).strip()


def get(item, key):
    return text(obj(item).get(key))


def add_template_page(output, template_path):
    source = fitz.open(template_path)
    source_page = source[0]
    page = output.new_page(width=source_page.rect.width, height=source_page.rect.height)
    page.show_pdf_page(page.rect, source, 0)
    source.close()
    page.insert_font(fontname="F06Regular", fontfile=str(FONT_REGULAR))
    page.insert_font(fontname="F06Bold", fontfile=str(FONT_BOLD))
    return page


def put(page, box, content, size=10, align=0, bold=False, erase=True):
    content = text(content)
    if not content:
        return
    rect = fitz.Rect(box)
    font = "F06Bold" if bold else "F06Regular"
    font_object = FONT_BOLD_OBJ if bold else FONT_REGULAR_OBJ
    current = size + 1
    while current > 4 and font_object.text_length(content, fontsize=current) > rect.width - 2:
        current -= 0.5
    width = font_object.text_length(content, fontsize=current)
    if align == 1:
        x = rect.x0 + max(1, (rect.width - width) / 2)
    elif align == 2:
        x = rect.x1 - width - 1
    else:
        x = rect.x0 + 1
    if erase:
        # Keep the complete glyph visibly above the original dotted underline.
        baseline = rect.y1 - max(9, current * 1.15)
    else:
        # Table values are vertically centered without covering cell borders.
        baseline = rect.y0 + (rect.height / 2) + (current * 0.34)
    page.insert_text(
        (x, baseline),
        content,
        fontname=font,
        fontsize=current,
        color=INK,
        overlay=True,
    )


def mark(page, x, y, selected):
    if not selected:
        return
    rect = fitz.Rect(x + 2.0, y + 4.0, x + 9.0, y + 12.0)
    page.draw_line(rect.tl, rect.br, color=INK, width=1.3, overlay=True)
    page.draw_line(rect.bl, rect.tr, color=INK, width=1.3, overlay=True)


def mark_value(page, value, positions):
    for expected, x, y in positions:
        mark(page, x, y, value == expected)


def place_photo(page, data_url):
    target = fitz.Rect(1064, 291, 1164, 425)
    if data_url == "__SAMPLE__":
        page.draw_rect(target, color=None, fill=(0.94, 0.95, 0.96), overlay=True)
        page.draw_circle((1114, 330), 18, color=INK, fill=(0.82, 0.85, 0.88), width=1, overlay=True)
        page.draw_oval(fitz.Rect(1088, 350, 1140, 405), color=INK, fill=(0.82, 0.85, 0.88), width=1, overlay=True)
        page.insert_text((1094, 420), "SAMPLE", fontname="F06Bold", fontsize=9, color=INK, overlay=True)
        return
    if not data_url or "," not in data_url:
        return
    try:
        raw = base64.b64decode(data_url.split(",", 1)[1])
        pix = fitz.Pixmap(raw)
        page.draw_rect(target, color=None, fill=(1, 1, 1), overlay=True)
        ratio = min(target.width / pix.width, target.height / pix.height)
        width, height = pix.width * ratio, pix.height * ratio
        area = fitz.Rect(
            target.x0 + (target.width - width) / 2,
            target.y0 + (target.height - height) / 2,
            target.x0 + (target.width + width) / 2,
            target.y0 + (target.height + height) / 2,
        )
        page.insert_image(area, stream=raw, keep_proportion=True, overlay=True)
    except Exception:
        return


def fill_page1(page, data):
    p = obj(data.get("page1"))

    contacts = arr(p.get("emergencyContacts"))
    for index, y in enumerate((60, 101)):
        if index >= len(contacts):
            break
        item = obj(contacts[index])
        put(page, (100, y, 345, y + 15), get(item, "name"), 9)
        put(page, (430, y, 565, y + 15), get(item, "relation"), 9)
        put(page, (55, y + 20, 400, y + 36), get(item, "address"), 8)
        put(page, (470, y + 20, 565, y + 36), get(item, "phone"), 9)

    put(page, (145, 168, 565, 184), get(p, "heardFrom"), 9)
    mark_value(page, get(p, "knowsEmployee"), (("no", 268.9, 185.4), ("yes", 318.3, 185.4)))
    for index, y in enumerate((209, 229, 250)):
        known = arr(p.get("knownEmployees"))
        if index >= len(known):
            break
        item = obj(known[index])
        put(page, (100, y, 290, y + 16), get(item, "name"), 8)
        put(page, (375, y, 465, y + 16), get(item, "dept") or get(item, "department"), 8)
        put(page, (505, y, 566, y + 16), get(item, "relation"), 8)

    mark_value(page, get(p, "smoking"), (("no", 94.1, 269.8), ("yes", 134.7, 269.8)))
    put(page, (178, 270, 213, 286), get(p, "smokingPerDay"), 9, align=1)
    mark_value(page, get(p, "chronicDisease"), (("no", 170.2, 290.1), ("yes", 205.2, 290.1)))
    put(page, (260, 290, 560, 307), get(p, "chronicDiseaseDetail"), 8)
    mark_value(page, get(p, "seriousIllness"), (("never", 19.6, 329.8), ("yes", 62.4, 329.8)))
    put(page, (105, 330, 145, 347), get(p, "seriousIllnessTimes"), 9, align=1)
    put(page, (220, 330, 560, 347), get(p, "seriousIllnessReason"), 8)
    mark_value(page, get(p, "legalCase"), (("never", 214.2, 349.6), ("yes", 257.2, 349.6)))
    put(page, (302, 350, 342, 367), get(p, "legalCaseTimes"), 9, align=1)
    put(page, (120, 373, 565, 388), get(p, "legalCaseDetail"), 8)
    put(page, (82, 558, 265, 575), get(p, "signatureName"), 10, align=1)
    put(page, (472, 558, 555, 575), get(p, "signatureDate"), 9, align=1)

    put(page, (760, 175, 1145, 192), get(p, "positionApplied"), 11, bold=True)
    put(page, (760, 204, 910, 220), get(p, "expectedSalary"), 10, align=1)
    put(page, (1012, 204, 1138, 220), get(p, "availableDate"), 9, align=1)
    put(page, (770, 265, 1055, 280), get(p, "nameTh"), 11, bold=True)
    put(page, (780, 291, 1065, 307), get(p, "nameEn"), 10)
    put(page, (666, 312, 765, 327), get(p, "ethnicity"), 9, align=1)
    put(page, (798, 312, 886, 327), get(p, "nationality"), 9, align=1)
    put(page, (918, 312, 1053, 327), get(p, "religion"), 9, align=1)
    put(page, (699, 332, 780, 347), get(p, "birthDate"), 9, align=1)
    put(page, (800, 332, 839, 347), get(p, "age"), 9, align=1)
    put(page, (881, 332, 937, 347), get(p, "weight"), 9, align=1)
    put(page, (984, 332, 1038, 347), get(p, "height"), 9, align=1)
    put(page, (707, 352, 849, 367), get(p, "idCardNo"), 9, align=1)
    put(page, (936, 352, 1055, 367), get(p, "idCardIssuedAt"), 8, align=1)
    put(page, (685, 372, 850, 388), get(p, "idCardIssueDate"), 9, align=1)
    put(page, (898, 372, 1054, 388), get(p, "idCardExpiry"), 9, align=1)
    place_photo(page, get(p, "photoData"))

    registered = obj(p.get("regAddress"))
    put(page, (760, 392, 820, 407), get(registered, "houseNo"), 8, align=1)
    put(page, (878, 392, 916, 407), get(registered, "moo"), 8, align=1)
    put(page, (970, 392, 1065, 407), get(registered, "village"), 8, align=1)
    put(page, (700, 412, 815, 427), get(registered, "soi"), 8, align=1)
    put(page, (865, 412, 980, 427), get(registered, "road"), 8, align=1)
    put(page, (715, 435, 825, 450), get(registered, "tambon"), 8, align=1)
    put(page, (875, 435, 985, 450), get(registered, "amphoe"), 8, align=1)
    put(page, (1040, 435, 1158, 450), get(registered, "province"), 8, align=1)
    put(page, (710, 455, 800, 470), get(registered, "zip"), 8, align=1)
    put(page, (875, 455, 975, 470), get(registered, "phone"), 8, align=1)

    current = obj(p.get("curAddress"))
    put(page, (820, 475, 860, 491), get(current, "houseNo"), 8, align=1)
    put(page, (910, 475, 945, 491), get(current, "moo"), 8, align=1)
    put(page, (990, 475, 1070, 491), get(current, "village"), 8, align=1)
    put(page, (1110, 475, 1158, 491), get(current, "soi"), 8, align=1)
    put(page, (685, 496, 800, 511), get(current, "road"), 8, align=1)
    put(page, (850, 496, 970, 511), get(current, "tambon"), 8, align=1)
    put(page, (1050, 496, 1158, 511), get(current, "amphoe"), 8, align=1)
    put(page, (700, 516, 820, 531), get(current, "province"), 8, align=1)
    put(page, (895, 516, 970, 531), get(current, "zip"), 8, align=1)
    put(page, (1050, 516, 1158, 531), get(current, "phone"), 8, align=1)
    mark_value(
        page,
        get(p, "livingType"),
        (
            ("dorm", 698.2, 531.8),
            ("rent", 740.7, 531.8),
            ("own", 789.4, 531.8),
            ("parents", 847.9, 531.8),
            ("other", 930.1, 531.8),
        ),
    )
    put(page, (1015, 532, 1158, 550), get(p, "livingOther"), 8)

    father = obj(p.get("father"))
    put(page, (715, 556, 918, 570), get(father, "name"), 9, align=1)
    put(page, (938, 556, 1003, 570), get(father, "age"), 8, align=1)
    put(page, (1036, 556, 1081, 570), get(father, "nationality"), 8, align=1)
    put(page, (1115, 556, 1160, 570), get(father, "ethnicity"), 8, align=1)
    mark_value(page, get(father, "alive"), (("alive", 634.5, 572.5), ("dead", 1090.0, 572.5)))
    put(page, (730, 573, 830, 590), get(father, "occupation"), 8, align=1)
    put(page, (900, 573, 1085, 590), get(father, "workplace"), 8, align=1)

    mother = obj(p.get("mother"))
    put(page, (724, 597, 918, 611), get(mother, "name"), 9, align=1)
    put(page, (938, 597, 1003, 611), get(mother, "age"), 8, align=1)
    put(page, (1036, 597, 1081, 611), get(mother, "nationality"), 8, align=1)
    put(page, (1115, 597, 1160, 611), get(mother, "ethnicity"), 8, align=1)
    mark_value(page, get(mother, "alive"), (("alive", 634.5, 612.7), ("dead", 1090.0, 612.7)))
    put(page, (730, 613, 830, 630), get(mother, "occupation"), 8, align=1)
    put(page, (900, 613, 1085, 630), get(mother, "workplace"), 8, align=1)

    siblings = obj(p.get("siblings"))
    put(page, (737, 637, 795, 652), get(siblings, "total"), 8, align=1)
    put(page, (830, 637, 891, 652), get(siblings, "male"), 8, align=1)
    put(page, (928, 637, 998, 652), get(siblings, "female"), 8, align=1)
    put(page, (1062, 637, 1114, 652), get(siblings, "order"), 8, align=1)
    sibling_rows = arr(siblings.get("list"))
    for index, y in enumerate((672, 692.2, 712.5, 732.8, 753.2, 773.6)):
        if index >= len(sibling_rows):
            break
        item = obj(sibling_rows[index])
        row_bottom = (692.1, 712.5, 732.8, 753.2, 773.6, 793.9)[index]
        fields = (
            ((636, y, 677, row_bottom), str(index + 1)),
            ((680, y, 835, row_bottom), get(item, "name")),
            ((837, y, 884, row_bottom), get(item, "age")),
            ((886, y, 963, row_bottom), get(item, "occupation")),
            ((965, y, 1084, row_bottom), get(item, "workplace")),
            ((1086, y, 1159, row_bottom), get(item, "position")),
        )
        for box, content in fields:
            put(page, box, content, 7, align=1, erase=False)


def fill_page2(page, data):
    marital = obj(data.get("marital"))
    spouse = obj(marital.get("spouse"))
    status = get(marital, "status")
    mark_value(page, status, (("single", 71.8, 40.2), ("widowed", 105.7, 40.2), ("divorced", 147.0, 40.2), ("married", 141.5, 63.5)))
    mark(page, 70.3, 63.5, status == "married")
    put(page, (208, 64, 255, 81), get(marital, "marriedYear"), 9, align=1)
    mark(page, 271.9, 63.5, bool(get(marital, "registeredYear")))
    put(page, (390, 64, 430, 81), get(marital, "registeredYear"), 9, align=1)
    mark(page, 443.2, 63.5, bool(marital.get("notRegistered")))
    put(page, (165, 88, 328, 104), get(spouse, "name"), 9, align=1)
    put(page, (348, 88, 382, 104), get(spouse, "age"), 8, align=1)
    put(page, (424, 88, 467, 104), get(spouse, "nationality"), 8, align=1)
    put(page, (501, 88, 544, 104), get(spouse, "ethnicity"), 8, align=1)
    mark_value(page, get(spouse, "alive"), (("alive", 19.8, 109.8), ("dead", 498.4, 109.8)))
    put(page, (101, 110, 189, 127), get(spouse, "occupation"), 8, align=1)
    put(page, (246, 110, 355, 127), get(spouse, "workplace"), 8, align=1)
    put(page, (391, 110, 493, 127), get(spouse, "position"), 8, align=1)
    put(page, (62, 135, 94, 151), get(marital, "childrenCount"), 8, align=1)
    for index, child in enumerate(arr(marital.get("children"))[:6]):
        gender_x = (162, 309, 453, 162, 309, 453)[index]
        year_x = (228, 375, 520, 228, 375, 520)[index]
        y = 135 if index < 3 else 158
        put(page, (gender_x, y, gender_x + 40, y + 17), get(child, "gender"), 8, align=1)
        put(page, (year_x, y, year_x + 45, y + 17), get(child, "birthYear"), 8, align=1)

    military = obj(data.get("military"))
    mark_value(page, get(military, "status"), (("served", 19.8, 202.7), ("upcoming", 97.0, 202.7), ("exempt", 260.2, 202.7)))
    put(page, (205, 203, 250, 220), get(military, "year"), 9, align=1)
    put(page, (365, 203, 565, 220), get(military, "exemptReason"), 8)

    languages = obj(data.get("languages"))
    rows = (("english", 58), ("chinese", 81), ("japanese", 104), ("other", 127))
    columns = (("speak", 820, 906), ("write", 906, 992), ("read", 992, 1078), ("listen", 1078, 1161))
    for key, y in rows:
        item = obj(languages.get(key))
        if key == "other":
            put(page, (670, y, 810, y + 22), get(item, "name"), 8, align=1)
        for field, x0, x1 in columns:
            put(page, (x0, y, x1, y + 22), get(item, field), 8, align=1, erase=False)

    skills = obj(data.get("skills"))
    mark(page, 634.9, 179.4, bool(get(skills, "computer")))
    put(page, (790, 180, 1145, 197), get(skills, "computer"), 8)
    mark(page, 634.9, 202.7, bool(get(skills, "other")))
    put(page, (800, 203, 1145, 220), get(skills, "other"), 8)

    level_rows = {
        "primary": 292.6,
        "m1": 315.8,
        "m2": 339.0,
        "vocational": 339.0,
        "diploma": 362.2,
        "bachelor": 385.4,
        "master": 408.6,
        "other": 431.8,
    }
    used = set()
    for index, item in enumerate(arr(data.get("education"))):
        item = obj(item)
        y = level_rows.get(get(item, "level"), 292.6 + index * 23.2)
        while y in used and y <= 431.8:
            y = round(y + 23.2, 1)
        if y > 431.8:
            break
        used.add(y)
        if get(item, "level") == "other":
            put(page, (20, y, 105, y + 23.2), get(item, "otherLevel"), 7, align=1)
        fields = (
            ((108, y, 283, y + 23.2), get(item, "school")),
            ((287, y, 338, y + 23.2), get(item, "from")),
            ((342, y, 393, y + 23.2), get(item, "to")),
            ((397, y, 452, y + 23.2), get(item, "degree")),
            ((455, y, 530, y + 23.2), get(item, "major")),
            ((533, y, 586, y + 23.2), get(item, "gpa")),
        )
        for box, content in fields:
            put(page, box, content, 7, align=1, erase=False)

    vehicle = obj(data.get("vehicles"))
    mark_value(page, get(vehicle, "hasCar"), (("no", 736.6, 272.3), ("yes", 774.5, 272.3)))
    put(page, (905, 273, 1148, 290), get(vehicle, "carDetail"), 8)
    mark_value(page, get(vehicle, "hasCarLicense"), (("no", 691.8, 295.5), ("yes", 730.4, 295.5)))
    mark_value(page, get(vehicle, "carLicenseType"), (("yearly", 816.1, 295.5), ("lifetime", 855.9, 295.5)))
    put(page, (990, 296, 1148, 313), get(vehicle, "carLicenseNo"), 8)
    mark_value(page, get(vehicle, "hasMotorcycle"), (("no", 766.9, 318.6), ("yes", 804.8, 318.6)))
    put(page, (930, 319, 1148, 336), get(vehicle, "motorcycleDetail"), 8)
    mark_value(page, get(vehicle, "hasMotorcycleLicense"), (("no", 722.1, 341.9), ("yes", 760.0, 341.9)))
    mark_value(page, get(vehicle, "motorcycleLicenseType"), (("yearly", 845.6, 341.9), ("lifetime", 885.6, 341.9)))
    put(page, (1010, 342, 1148, 359), get(vehicle, "motorcycleLicenseNo"), 8)

    for index, item in enumerate(arr(data.get("references"))[:2]):
        item = obj(item)
        y = 408.6 + index * 23.2
        fields = (
            ((635, y, 669, y + 23.2), str(index + 1)),
            ((672, y, 809, y + 23.2), get(item, "name")),
            ((812, y, 875, y + 23.2), get(item, "relation")),
            ((878, y, 950, y + 23.2), get(item, "occupation")),
            ((953, y, 1095, y + 23.2), get(item, "address")),
            ((1098, y, 1160, y + 23.2), get(item, "phone")),
        )
        for box, content in fields:
            put(page, box, content, 6.5, align=1, erase=False)

    for index, item in enumerate(arr(data.get("workHistory"))[:7]):
        item = obj(item)
        y = 535.1 + index * 23.2
        fields = (
            ((20, y, 82, y + 22), get(item, "fromDate")),
            ((85, y, 145, y + 22), get(item, "toDate")),
            ((148, y, 301, y + 22), get(item, "company")),
            ((304, y, 379, y + 22), get(item, "businessType")),
            ((382, y, 464, y + 22), get(item, "startPosition")),
            ((468, y, 549, y + 22), get(item, "endPosition")),
            ((553, y, 790, y + 22), get(item, "responsibilities")),
            ((793, y, 870, y + 22), get(item, "salaryStart")),
            ((873, y, 946, y + 22), get(item, "salaryEnd")),
            ((950, y, 1160, y + 22), get(item, "leaveReason")),
        )
        for box, content in fields:
            put(page, box, content, 6, align=1, erase=False)

    hobbies = [item.strip() for item in re.split(r"[,;\n]+", text(data.get("hobbies"))) if item.strip()]
    for index, hobby in enumerate(hobbies[:3]):
        y = 743.9 + index * 23.25
        put(page, (15, y, 207, y + 23.25), hobby, 7, align=1, erase=False)
    for index, item in enumerate(arr(data.get("clubs"))[:3]):
        item = obj(item)
        y = 743.9 + index * 23.25
        put(page, (207, y, 400, y + 23.15), get(item, "name"), 7, align=1, erase=False)
        put(page, (400, y, 581, y + 23.15), get(item, "position"), 7, align=1, erase=False)
    for index, item in enumerate(arr(data.get("trainings"))[:2]):
        item = obj(item)
        y = 767.2 + index * 23.15
        put(page, (629, y, 679, y + 23.15), get(item, "from"), 7, align=1, erase=False)
        put(page, (679, y, 728, y + 23.15), get(item, "to"), 7, align=1, erase=False)
        put(page, (728, y, 955, y + 23.15), get(item, "course"), 7, align=1, erase=False)
        put(page, (955, y, 1161, y + 23.15), get(item, "institute"), 7, align=1, erase=False)


def build_pdf(record, output_path):
    data = obj(record.get("data")) if "data" in record else obj(record)
    output = fitz.open()
    add_template_page(output, PAGE1_TEMPLATE)
    add_template_page(output, PAGE2_TEMPLATE)
    page1 = output[0]
    page2 = output[1]
    fill_page1(page1, data)
    fill_page2(page2, data)
    applicant = get(obj(data.get("page1")), "nameTh")
    output.set_metadata(
        {
            "title": "F06-005 Rev.2 ใบสมัครงาน",
            "subject": applicant,
            "author": applicant,
            "creator": "HRregister",
        }
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output.save(output_path, garbage=4, deflate=True)
    output.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, type=Path)
    parser.add_argument("--id")
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--docx-dir", help=argparse.SUPPRESS)
    args = parser.parse_args()
    payload = json.loads(args.data.read_text(encoding="utf-8-sig"))
    if isinstance(payload, list):
        record = next((item for item in payload if text(item.get("id")) == text(args.id)), None)
        if record is None:
            raise SystemExit(f"ไม่พบใบสมัครรหัส {args.id}")
    else:
        record = payload
    build_pdf(record, args.output)
    print(args.output)


if __name__ == "__main__":
    main()
