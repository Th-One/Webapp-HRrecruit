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

// ช่วงเวลาที่เลือกจากการ์ดสถิติ — null คือยังไม่ได้เลือก (แสดงทั้งหมด)
let activeScope = null;

const SCOPE_TITLE = {
  all: "ใบสมัครทั้งหมด",
  month: "ใบสมัครที่ส่งมาในเดือนนี้",
  today: "ใบสมัครที่ส่งมาวันนี้",
};

const DEFAULT_TITLE = "ตำแหน่งที่สมัคร";

function isSameDay(date, now) {
  return date.toDateString() === now.toDateString();
}

function isSameMonth(date, now) {
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function recordsInScope(list, scope) {
  if (scope !== "month" && scope !== "today") return list;
  const now = new Date();
  return list.filter((r) => {
    const d = new Date(r.createdAt);
    return scope === "today" ? isSameDay(d, now) : isSameMonth(d, now);
  });
}

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
  const today = list.filter((r) => isSameDay(new Date(r.createdAt), now)).length;
  const month = list.filter((r) => isSameMonth(new Date(r.createdAt), now)).length;
  document.getElementById("stat-total").textContent = list.length;
  document.getElementById("stat-month").textContent = month;
  document.getElementById("stat-today").textContent = today;
}

function updatePositionDashboard(list) {
  const section = document.getElementById("position-dashboard");
  const title = document.getElementById("position-dashboard-title");
  const summary = document.getElementById("position-dashboard-summary");
  const container = document.getElementById("position-bars");
  const scoped = recordsInScope(list, activeScope);
  const counts = new Map();

  for (const record of scoped) {
    const position = record.data?.page1?.positionApplied?.trim() || "(ไม่ระบุตำแหน่ง)";
    counts.set(position, (counts.get(position) || 0) + 1);
  }

  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "th"));
  const max = rows[0]?.[1] || 0;

  title.textContent = SCOPE_TITLE[activeScope] || DEFAULT_TITLE;
  // ซ่อนเฉพาะตอนไม่มีใบสมัครเลย ถ้าเลือกช่วงแล้วไม่มีข้อมูลให้บอกผู้ใช้แทน
  section.hidden = !list.length;
  summary.textContent = rows.length
    ? `${rows.length} ตำแหน่ง · รวม ${scoped.length} ใบสมัคร`
    : "";

  if (!rows.length) {
    container.innerHTML = `<div class="position-empty">ไม่มีใบสมัครในช่วงที่เลือก</div>`;
    return;
  }

  container.innerHTML = rows
    .map(([position, count]) => {
      const pct = max ? Math.round((count / max) * 100) : 0;
      return `
        <div class="position-row">
          <div class="position-label" title="${escapeHtml(position)}">${escapeHtml(position)}</div>
          <div class="position-count">${count} ใบ</div>
          <div class="position-track">
            <div class="position-fill" style="width:${pct}%"></div>
          </div>
        </div>`;
    })
    .join("");
}

async function load() {
  const res = await fetch("/api/applications");
  allRecords = await res.json();
  updateStats(allRecords);
  updatePositionDashboard(allRecords);
  renderList(document.getElementById("search").value);
}

function setScope(scope) {
  // กดการ์ดเดิมซ้ำ = ยกเลิกการเลือก กลับไปหัวข้อเริ่มต้น
  activeScope = activeScope === scope ? null : scope;
  document.querySelectorAll(".stat-card[data-scope]").forEach((card) => {
    card.setAttribute("aria-pressed", String(card.dataset.scope === activeScope));
  });
  updatePositionDashboard(allRecords);
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("search").addEventListener("input", (e) => {
    renderList(e.target.value);
  });
  document.querySelectorAll(".stat-card[data-scope]").forEach((card) => {
    card.addEventListener("click", () => setScope(card.dataset.scope));
  });
  load().catch(() => toast("โหลดข้อมูลไม่สำเร็จ", true));
});
