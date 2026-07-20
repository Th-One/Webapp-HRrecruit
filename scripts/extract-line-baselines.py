"""สกัด baseline จริงของเส้นจุดไข่ปลาทุกเส้นจาก template F06-005 -> pdf/line-baselines.json

ใช้เมื่อ template เปลี่ยน แล้ว generate-f06.js จะ snap ข้อความเข้าเส้นให้อัตโนมัติ

    python scripts/extract-line-baselines.py
"""
import json
import fitz  # PyMuPDF

TEMPLATES = ["templates/F06-005-page1.pdf", "templates/F06-005-page2.pdf"]
OUTPUT = "pdf/line-baselines.json"

result = {}
for index, path in enumerate(TEMPLATES):
    page = fitz.open(path)[0]
    rows = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            for span in line["spans"]:
                # เส้นในแบบฟอร์มเป็นอักขระจุด ไม่ใช่ vector line
                if "...." in span["text"]:
                    rows.append({
                        "y": round(span["origin"][1], 2),
                        "x0": round(span["bbox"][0], 1),
                        "x1": round(span["bbox"][2], 1),
                    })
    rows.sort(key=lambda r: (r["y"], r["x0"]))
    result[f"page{index + 1}"] = rows
    print(f"page{index + 1}: {len(rows)} dotted-line spans")

with open(OUTPUT, "w", encoding="utf-8") as fh:
    json.dump(result, fh, ensure_ascii=False, indent=0)
print(f"wrote {OUTPUT}")
