const MARITAL_LABEL = {
  single: "โสด",
  widowed: "หม้าย",
  divorced: "หย่าร้าง",
  married: "มีสามี-ภรรยา",
};

const EDU_LABEL = {
  primary: "ประถมศึกษา",
  m1: "มัธยมต้น",
  m2: "มัธยมปลาย/อาชีวฯ",
  diploma: "อนุปริญญา",
  bachelor: "ปริญญาตรี",
  master: "ปริญญาโท",
  other: "อื่นๆ",
};

function toast(msg, isError = false) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.toggle("error", isError);
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 3200);
}

function fmtDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summary(record) {
  const d = record.data || {};
  const p = d.page1 || {};
  const name = p.nameTh || p.nameEn || "-";
  const position = p.positionApplied || "-";
  const company = d.workHistory?.[0]?.company || "-";
  return { name, position, company };
}

function searchText(record) {
  const d = record.data || {};
  const p = d.page1 || {};
  const parts = [
    p.nameTh,
    p.nameEn,
    p.positionApplied,
    p.idCardNo,
    p.curAddress?.phone,
    p.regAddress?.phone,
    d.marital?.spouse?.name,
    d.skills?.computer,
    d.skills?.other,
    d.hobbies,
    ...(d.workHistory || []).flatMap((w) => [w.company, w.endPosition]),
    ...(d.references || []).flatMap((r) => [r.name, r.phone]),
    ...(d.education || []).map((e) => e.school),
  ];
  return parts.filter(Boolean).join(" ").toLowerCase();
}

let allRecords = [];

function renderList(filter = "") {
  const tbody = document.getElementById("list-body");
  const q = filter.trim().toLowerCase();
  const rows = allRecords.filter((r) => !q || searchText(r).includes(q));

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty">ไม่พบใบสมัคร</td></tr>`;
    return;
  }

  tbody.innerHTML = rows
    .map((r) => {
      const s = summary(r);
      return `
        <tr>
          <td>${fmtDate(r.createdAt)}</td>
          <td><strong>${escapeHtml(s.name)}</strong></td>
          <td>${escapeHtml(s.position)}</td>
          <td>${escapeHtml(s.company)}</td>
          <td>
            <a href="/hr/view.html?id=${r.id}">ดู</a> ·
            <a href="/api/applications/${encodeURIComponent(r.id)}/f06.pdf">PDF</a> ·
            <a href="#" data-del="${r.id}" class="del-link">ลบ</a>
          </td>
        </tr>`;
    })
    .join("");

  tbody.querySelectorAll("[data-del]").forEach((a) => {
    a.addEventListener("click", async (e) => {
      e.preventDefault();
      if (!confirm("ลบใบสมัครนี้?")) return;
      const id = a.getAttribute("data-del");
      const res = await fetch(`/api/applications/${id}`, { method: "DELETE" });
      if (!res.ok) return toast("ลบไม่สำเร็จ", true);
      toast("ลบแล้ว");
      await load();
    });
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function updateStats(list) {
  const now = new Date();
  const today = list.filter((r) => {
    const d = new Date(r.createdAt);
    return d.toDateString() === now.toDateString();
  }).length;
  const month = list.filter((r) => {
    const d = new Date(r.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  document.getElementById("stat-total").textContent = list.length;
  document.getElementById("stat-month").textContent = month;
  document.getElementById("stat-today").textContent = today;
}

async function load() {
  const res = await fetch("/api/applications");
  allRecords = await res.json();
  updateStats(allRecords);
  renderList(document.getElementById("search").value);
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("search").addEventListener("input", (e) => {
    renderList(e.target.value);
  });
  load().catch(() => toast("โหลดข้อมูลไม่สำเร็จ", true));
});
