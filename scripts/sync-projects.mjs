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

// 표시 순서: 운영중 → 출시임박 → 개발중 → 진행예정. 알 수 없는 상태는 맨 아래로.
const STATUS_TIER = { 운영중: 0, 출시임박: 1, 개발중: 2, 진행예정: 3 };

const res = await fetch(API, {
  headers: {
    accept: "application/json",
    "user-agent":
      "Mozilla/5.0 (compatible; progreneur-readme-sync/1.0; +https://github.com/sanghunDev/sanghunDev)",
  },
});
if (!res.ok) {
  const body = (await res.text()).slice(0, 300);
  console.error(`✗ API ${res.status} — README 변경 없음\n응답 헤더 server=${res.headers.get("server")} cf-mitigated=${res.headers.get("cf-mitigated")}\n${body}`);
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

// 같은 상태 안에서는 position(사이트 자체 표시 순서, 완성도·중요도로 수동 정렬)을 그대로 따른다.
const byStatusThenPosition = (a, b) => {
  const ta = STATUS_TIER[a.status] ?? 99;
  const tb = STATUS_TIER[b.status] ?? 99;
  if (ta !== tb) return ta - tb;
  return (a.position ?? 0) - (b.position ?? 0);
};

const buildTable = (list) => {
  const rows = list
    .slice()
    .sort(byStatusThenPosition)
    .map((p) => {
      const link = p.href || `https://progreneur.com/projects/${p.id}`;
      const status = STATUS_LABEL[p.status] || p.status || "";
      return `| [${cell(p.name)}](${link}) | ${cell(p.summary)} | ${status} |`;
    });
  return ["| 서비스 | 한 줄 소개 | 상태 |", "|---|---|---|", ...rows].join("\n");
};

// category가 "Web · ..." 형태면 웹, 그 외(현재는 "App")는 앱으로 분류한다.
const isWeb = (p) => String(p.category ?? "").startsWith("Web");
const webProjects = projects.filter(isWeb);
const appProjects = projects.filter((p) => !isWeb(p));

const sections = [];
if (webProjects.length) sections.push(`### Web\n\n${buildTable(webProjects)}`);
if (appProjects.length) sections.push(`### App\n\n${buildTable(appProjects)}`);
const table = sections.join("\n\n");

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
