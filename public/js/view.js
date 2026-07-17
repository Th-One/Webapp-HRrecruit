function toast(msg, err = false) {
  const el = document.getElementById("toast");
  el.textContent = msg; el.classList.toggle("error", err); el.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove("show"), 3200);
}

function renderDetail(record) {
  const d = record.data || {};
  const p = d.page1 || {};
  const name = p.nameTh || p.nameEn || "—";
  const previewUrl = `/api/applications/${encodeURIComponent(record.id)}/f06.pdf?inline=1`;
  document.getElementById("detail").innerHTML = `
    <iframe class="f06-preview" src="${previewUrl}" title="ตัวอย่างใบสมัคร F06-005"></iframe>`;
  document.getElementById("meta").innerHTML = `
    <span>ผู้สมัคร: <strong>${esc(name)}</strong></span>
    <span>ตำแหน่ง: ${esc(p.positionApplied || "—")}</span>
    <span>รหัส: <strong>${esc(record.id.slice(0, 8))}</strong></span>
    <span>บันทึกเมื่อ: ${fmtDate(record.createdAt)}</span>`;
}

async function main() {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  if (!id) { document.getElementById("detail").innerHTML = '<p class="empty">ไม่ระบุรหัสใบสมัคร</p>'; return; }
  const res = await fetch(`/api/applications/${id}`);
  if (!res.ok) { document.getElementById("detail").innerHTML = '<p class="empty">ไม่พบใบสมัคร</p>'; return; }
  const record = await res.json();
  renderDetail(record);
  document.getElementById("btn-print").addEventListener("click", () => {
    window.open(`/api/applications/${encodeURIComponent(id)}/f06.pdf?inline=1`, "_blank");
  });
  document.getElementById("btn-download").addEventListener("click", () => {
    window.location.href = `/api/applications/${encodeURIComponent(id)}/f06.pdf`;
  });
  document.getElementById("btn-back").addEventListener("click", () => location.href = "/hr/");
  document.getElementById("btn-delete").addEventListener("click", async () => {
    if (!confirm("ลบใบสมัครนี้?")) return;
    const del = await fetch(`/api/applications/${id}`, { method: "DELETE" });
    if (!del.ok) return toast("ลบไม่สำเร็จ", true);
    location.href = "/hr/";
  });
}
main().catch(() => toast("โหลดไม่สำเร็จ", true));
