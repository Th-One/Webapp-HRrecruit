function toast(msg, err = false) {
  const el = document.getElementById("toast");
  el.textContent = msg; el.classList.toggle("error", err); el.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove("show"), 3200);
}

function main() {
  const raw = sessionStorage.getItem("previewData");
  if (!raw) {
    document.getElementById("detail").innerHTML = '<p class="empty">ไม่มีข้อมูลตัวอย่าง กรุณากลับไปกรอกฟอร์ม</p>';
    return;
  }
  let data;
  try { data = JSON.parse(raw); } catch { data = {}; }
  const stamp = "ตัวอย่างก่อนส่ง · ยังไม่บันทึก";
  document.getElementById("detail").innerHTML = `<div class="paper">${renderPaper(data, { stamp })}</div>`;

  document.getElementById("btn-download").addEventListener("click", () => window.print());
  document.getElementById("btn-print").addEventListener("click", () => window.print());
  document.getElementById("btn-back").addEventListener("click", () => {
    sessionStorage.setItem("restoreData", raw);
    location.href = "/";
  });
}
main();
