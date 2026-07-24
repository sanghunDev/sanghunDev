// progreneur.com 공개 API의 프로젝트 목록을 README '만들고 운영하는 것들' 표로 동기화한다.
// - 소스: https://progreneur.com/api/projects (D1 최신 상태, 인증 불필요)
// - README의 마커(<!-- PROGRENEUR-PROJECTS:START/END -->) 사이만 교체한다.
// - API 실패/빈 응답이면 README를 건드리지 않고 실패로 종료한다(기존 표 보존).
// 실행: node scripts/sync-projects.mjs
import { readFileSync, writeFileSync } from "node:fs";

const API = "https://progreneur.com/api/projects";
const README = new URL("../README.md", import.meta.url);
const START = "<!-- PROGRENEUR-PROJECTS:START -->";
const END = "<!-- PROGRENEUR-PROJECTS:END -->";

const STATUS_LABEL = {
  운영중: "운영 중",
  출시임박: "출시 임박",
  개발중: "개발 중",
  진행예정: "진행 예정",
};

const res = await fetch(API, { headers: { accept: "application/json" } });
if (!res.ok) {
  console.error(`✗ API ${res.status} — README 변경 없음`);
  process.exit(1);
}
const projects = await res.json();
if (!Array.isArray(projects) || projects.length === 0) {
  console.error("✗ 프로젝트 0건 — README 변경 없음");
  process.exit(1);
}

const cell = (s) =>
  String(s ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.$/, "");

const rows = projects
  .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  .map((p) => {
    const link = p.href || `https://progreneur.com/projects/${p.id}`;
    const status = STATUS_LABEL[p.status] || p.status || "";
    return `| [${cell(p.name)}](${link}) | ${cell(p.summary)} | ${status} |`;
  });

const table = [
  "| 서비스 | 한 줄 소개 | 상태 |",
  "|---|---|---|",
  ...rows,
].join("\n");

const md = readFileSync(README, "utf8");
const si = md.indexOf(START);
const ei = md.indexOf(END);
if (si === -1 || ei === -1 || ei < si) {
  console.error("✗ README에 PROGRENEUR-PROJECTS 마커가 없음 — 변경 없음");
  process.exit(1);
}

const next =
  md.slice(0, si + START.length) + "\n" + table + "\n" + md.slice(ei);
if (next === md) {
  console.log("= 변경 없음 (이미 최신)");
} else {
  writeFileSync(README, next, "utf8");
  console.log(`✓ README 갱신 (프로젝트 ${projects.length}건)`);
}
