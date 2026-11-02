// @ts-nocheck
/* 대외협력 통합 데이터베이스 대시보드 — Vite + React (TSX). 타입 검사는 끄고(ts-nocheck) 바로 덮어써서 쓸 수 있게 구성했습니다. */
import React, { useState, useEffect, useMemo, useCallback, createContext, useContext, useRef } from "react";
import {
  Cloud, CloudOff, RefreshCw, Download, Upload, FileSpreadsheet, Plus, Trash2,
  Pencil, AlertTriangle, ChevronDown, ChevronRight, Settings2, X, Check,
  Building2, Users, Wallet, ClipboardCheck, Search, Info, ExternalLink,
  CheckCircle2, Circle, StickyNote, TrendingUp
} from "lucide-react";
import Papa from "papaparse";

/* =========================================================================
   상수 / 초기 데이터
========================================================================= */

const DEPARTMENTS = ["전략기획팀", "큐레이션팀", "디자인팀", "홍보팀"];
const DEFAULT_ORGANIZERS = ["명우", "가연", "세진", "윤서", "채현", "재민"]; // 구글 시트 팀원 탭 이름과 같게
const DEFAULT_ORGANIZERS_OLD = ["정상욱", "홍승아", "정성엽", "김민지", "이태원", "박서준"]; // 예전 기본값(자동 정리용)

const CATEGORY_OPTIONS = ["일반기업", "주제관련기업", "사회적기업"];
const STATUS_OPTIONS = ["컨택 전", "발송완료", "회신", "체결의사", "체결완료", "거절"];

const STATUS_STYLES = {
  "컨택 전": "bg-slate-100 text-slate-600 border-slate-300",
  "발송완료": "bg-sky-50 text-sky-700 border-sky-300",
  "회신": "bg-amber-50 text-amber-700 border-amber-300",
  "체결의사": "bg-violet-50 text-violet-700 border-violet-300",
  "체결완료": "bg-emerald-50 text-emerald-700 border-emerald-300",
  "거절": "bg-rose-50 text-rose-700 border-rose-300",
  "블랙리스트": "bg-slate-800 text-white border-slate-900",
};

const GENERATIONS = ["27기", "28기", "29기", "30기"];
const COLLAB_COUNTS = ["1회", "2회", "3회 이상"];
const FAMILY_DISCOUNT = { "1회": 0.03, "2회": 0.05, "3회 이상": 0.07 };

const GRADE_CONFIG = {
  LITE: {
    label: "Lite",
    accent: "border-slate-400 text-slate-700 bg-slate-50",
    options: [
      { key: "opt1", label: "옵션1 · 현금 20만 & 현물 35만 이상", cash: 200000, inKind: 350000, inKindOnly: false },
      { key: "opt2", label: "옵션2 · 현금 25만 이상", cash: 250000, inKind: 0, inKindOnly: false },
      { key: "opt3", label: "옵션3 · 현물만 (직접 입력)", cash: 0, inKind: null, inKindOnly: true },
    ],
  },
  STANDARD: {
    label: "Standard",
    accent: "border-blue-400 text-blue-700 bg-blue-50",
    options: [
      { key: "opt1", label: "옵션1 · 현금 40만 & 현물 55만 이상", cash: 400000, inKind: 550000, inKindOnly: false },
      { key: "opt2", label: "옵션2 · 현금 50만 이상", cash: 500000, inKind: 0, inKindOnly: false },
    ],
  },
  PREMIUM: {
    label: "Premium",
    accent: "border-rose-400 text-rose-700 bg-rose-50",
    options: [
      { key: "opt1", label: "옵션1 · 현금 60만 & 현물 75만 이상", cash: 600000, inKind: 750000, inKindOnly: false },
      { key: "opt2", label: "옵션2 · 현금 75만 이상", cash: 750000, inKind: 0, inKindOnly: false },
    ],
  },
};

/* -------------------------------------------------------------------------
   체크리스트(자료 수합 / 이행 현황) 공통 정의
   - 상태: "O"(완료) / "X"(미완료) / "불필요"(대상 아님, 진행률 계산에서 제외)
   - 사용자가 직접 바꾸지 않은 칸은 등급·얼리버드·패밀리 여부에 따라 기본값이 정해지고,
     한 번이라도 바꾸면 그 값이 우선합니다. (등급을 바꿔도 직접 입력한 값은 유지)
------------------------------------------------------------------------- */
const GRADE_RANK = { LITE: 0, STANDARD: 1, PREMIUM: 2 };
const STATUS_CHOICES = ["O", "X", "불필요"];

// [Tab 4] 자료 수합 항목 (minGrade 이상 등급에서 기본 대상)
const COLLECTION_GROUPS = [
  {
    key: "lite",
    label: "Lite 필수 (Lite · Standard · Premium 공통)",
    items: [
      { name: "VIP 정보", minGrade: "LITE" },
      { name: "로고", minGrade: "LITE" },
      { name: "인스타그램 계정", minGrade: "LITE" },
      { name: "기업 소개 문구", minGrade: "LITE" },
      { name: "현물 이미지", minGrade: "LITE" },
      { name: "상품 소개 문구", minGrade: "LITE" },
      { name: "현물 사이즈", minGrade: "LITE" },
    ],
  },
  {
    key: "standard",
    label: "Standard 추가 (Standard · Premium)",
    items: [
      { name: "홍보영상", minGrade: "STANDARD" },
      { name: "파트너사 맞춤형 숏폼 컨텐츠 기획안", short: "숏폼 컨텐츠 기획안", minGrade: "STANDARD" },
      { name: "오프라인 부스 운영 기획안", short: "부스 운영 기획안", minGrade: "STANDARD" },
    ],
  },
  {
    key: "premium",
    label: "Premium 추가 (Premium 전용)",
    items: [
      { name: "팸플릿 광고면", minGrade: "PREMIUM" },
      { name: "설문 문항", minGrade: "PREMIUM" },
      { name: "X배너", minGrade: "PREMIUM" },
    ],
  },
];

// 이전 버전에서 쓰던 자료 수합 항목명 → 현재 항목명 (저장된 데이터 유실 방지용)
const COLLECTION_RENAMES = {
  "기업 소개문구": "기업 소개 문구",
  "현물 소개 문구": "상품 소개 문구",
  "설문문항": "설문 문항",
  "X배너 이미지": "X배너",
};

// [Tab 5] 이행 현황 항목 (TEDxSNU 파트너십 혜택표 기준)
const EARLYBIRD_BOOTH = "서울대학교 교내 사전 부스 진행";
const EARLYBIRD_REVIEW = "후기 제공";
const THANKS_PREMIUM = "THANKS TO 카드뉴스 (프리미엄)";
const THANKS_FAMILY = "THANKS TO 카드뉴스 (패밀리)";
const FAMILY_BENEFIT = "패밀리 파트너 굿즈 제작 (떡메모지 등)";

const FULFILLMENT_GROUPS = [
  {
    key: "lite",
    label: "Lite 이상 (Lite · Standard · Premium 공통)",
    items: [
      { name: "VIP 강연 티켓 2매 무료 제공", short: "VIP 강연 티켓 2매", minGrade: "LITE" },
      { name: "청중 대상 브랜드 경품 이벤트 진행 (사전/본행사 부스 경품, 인스타그램 맞춤형 이벤트)", short: "청중 경품 이벤트", minGrade: "LITE" },
      { name: "기프트백에 파트너사 현물 및 현물소개서 동봉", short: "기프트백 현물·소개서 동봉", minGrade: "LITE" },
      { name: "사회자의 기업 소개", short: "사회자 기업 소개", minGrade: "LITE" },
      { name: "전 채널 로고 노출", minGrade: "LITE" },
      { name: "인스타그램 기프트백용 현물 소개 카드뉴스 게재", short: "현물 소개 카드뉴스", minGrade: "LITE" },
      { name: "인스타그램 현장스케치 카드뉴스 게재", short: "현장스케치 카드뉴스", minGrade: "LITE" },
    ],
  },
  {
    key: "standard",
    label: "Standard 이상 (Standard · Premium)",
    items: [
      { name: "파트너 홍보 영상 재생", short: "홍보 영상 재생", minGrade: "STANDARD" },
      { name: "본 행사 중 오프라인 홍보 부스 진행", short: "오프라인 홍보 부스", minGrade: "STANDARD" },
      { name: "컵홀더 내 기업 로고 기재 및 서울대학교 카페 배포", short: "컵홀더 로고·카페 배포", minGrade: "STANDARD" },
      { name: "맞춤형 온라인 홍보 이벤트 (공동 홍보)", short: "맞춤형 온라인 홍보 이벤트", minGrade: "STANDARD" },
      { name: "인스타그램에 파트너사 맞춤형 숏폼 콘텐츠 업로드", short: "숏폼 콘텐츠 업로드", minGrade: "STANDARD" },
    ],
  },
  {
    key: "premium",
    label: "Premium 전용",
    items: [
      { name: "단독 X-배너 제작 및 행사장 내 배치 (QR 코드 삽입)", short: "단독 X-배너 (QR)", minGrade: "PREMIUM" },
      { name: "온/오프라인 포스터, 강연 책자, 티켓 등에 로고 크기 2배", short: "로고 크기 2배", minGrade: "PREMIUM" },
      { name: "기프트백 현물 소개서에 프리미엄 단독 파트", short: "소개서 프리미엄 단독 파트", minGrade: "PREMIUM" },
      { name: "본 행사 팸플릿에 파트너 단독 광고면 삽입", short: "팸플릿 단독 광고면", minGrade: "PREMIUM" },
      { name: "기업 로고 굿즈 제작", minGrade: "PREMIUM" },
      { name: THANKS_PREMIUM, short: "THANKS TO 카드뉴스 (프리미엄)", minGrade: "PREMIUM" },
      { name: "설문조사 Raw Data 및 분석자료 제공 (5문항)", short: "설문 Raw Data·분석자료", minGrade: "PREMIUM" },
    ],
  },
  {
    key: "special",
    label: "특별 혜택 (얼리버드 / 패밀리)",
    items: [
      { name: EARLYBIRD_BOOTH, short: "교내 사전 부스 진행 (얼리버드)", flag: "earlyBird" },
      { name: EARLYBIRD_REVIEW, short: "후기 제공 (얼리버드)", flag: "earlyBird" },
      { name: FAMILY_BENEFIT, short: "패밀리 굿즈 (떡메모지 등)", flag: "family" },
      { name: THANKS_FAMILY, short: "THANKS TO 카드뉴스 (패밀리)", flag: "family" },
    ],
  },
];

const COLLECTION_NAMES = new Set(COLLECTION_GROUPS.flatMap((g) => g.items.map((i) => i.name)));

// 이전 버전(O/X 2상태) 데이터의 이행 항목 → 새 혜택표 항목 매핑
const LEGACY_FULFILLMENT_MAP = {
  "자체 굿즈 로고 삽입 여부": "기업 로고 굿즈 제작",
  "서울대 교내 부스 배치 여부": EARLYBIRD_BOOTH,
  "후기 전달 여부": EARLYBIRD_REVIEW,
  "인스타 THANKS TO 카드뉴스 게재 여부": THANKS_FAMILY,
};

// 직전 버전에서 저장된 이행 현황 항목명 정리 (저장된 체크·메모 유실 방지)
//  - 이름만 바뀐 항목
const FULFILLMENT_RENAMES = {
  "TEDxSNU 인스타그램에 THANKS TO 카드뉴스 추가 게재": THANKS_PREMIUM,
};
//  - 하나였다가 둘로 나뉜 항목: 기존 상태·메모를 두 항목에 똑같이 복사 (이후 각각 따로 수정)
const FULFILLMENT_SPLITS = {
  "서울대학교 교내 사전 부스 기업/현물 소개 및 후기 제공 (얼리버드)": [EARLYBIRD_BOOTH, EARLYBIRD_REVIEW],
};

// 사용자가 아직 바꾸지 않은 칸의 기본 상태
function defaultStatus(item, deal) {
  if (item.flag === "earlyBird") return deal.earlyBird ? "X" : "불필요";
  if (item.flag === "family") return deal.isFamilyPartner ? "X" : "불필요";
  const need = GRADE_RANK[item.minGrade || "LITE"] ?? 0;
  return (GRADE_RANK[deal.grade] ?? 0) >= need ? "X" : "불필요";
}

function getStatus(store, deal, item) {
  return store?.[deal.id]?.[item.name]?.status ?? defaultStatus(item, deal);
}

function getNote(store, deal, item) {
  return store?.[deal.id]?.[item.name]?.note ?? "";
}

// "불필요"는 분모에서 제외
function progressOf(store, deal, groups) {
  let done = 0;
  let total = 0;
  groups.forEach((g) =>
    g.items.forEach((item) => {
      const s = getStatus(store, deal, item);
      if (s === "불필요") return;
      total += 1;
      if (s === "O") done += 1;
    })
  );
  return { done, total };
}

// 저장 데이터 마이그레이션 (이전 버전 → 현재 구조)
//  - 등급 BASIC → LITE
//  - 단일 submissions(done:boolean) → collection / fulfillment (status: "O" | "X" | "불필요")
//  - 옮기지 못한 기존 항목은 legacySubmissions 에 그대로 보관 (유실 방지)
function migrateState(data) {
  if (!data || typeof data !== "object") return data;
  const next = { ...data };

  if (Array.isArray(next.deals)) {
    next.deals = next.deals.map((d) => (d && d.grade === "BASIC" ? { ...d, grade: "LITE" } : d));
  }

  if (next.submissions && typeof next.submissions === "object") {
    const hasNew = next.collection || next.fulfillment;
    if (!hasNew) {
      const collection = {};
      const fulfillment = {};
      const put = (store, dealId, name, v) => {
        const done = !!v?.done;
        const note = v?.note || "";
        if (!done && !note) return; // 건드리지 않은 칸은 기본값을 따르도록 비워둠
        const prev = store[dealId]?.[name];
        store[dealId] = store[dealId] || {};
        store[dealId][name] = {
          status: prev?.status === "O" || done ? "O" : "X",
          note: [prev?.note, note].filter(Boolean).join(" / "),
        };
      };
      Object.entries(next.submissions).forEach(([dealId, items]) => {
        Object.entries(items || {}).forEach(([rawName, v]) => {
          const name = COLLECTION_RENAMES[rawName] || rawName;
          if (COLLECTION_NAMES.has(name)) put(collection, dealId, name, v);
          else if (LEGACY_FULFILLMENT_MAP[name]) put(fulfillment, dealId, LEGACY_FULFILLMENT_MAP[name], v);
        });
      });
      next.collection = collection;
      next.fulfillment = fulfillment;
    }
    if (!next.legacySubmissions) next.legacySubmissions = next.submissions;
    delete next.submissions;
  }

  // 이미 새 구조로 저장된 자료 수합 데이터의 옛 항목명도 현재 이름으로 정리
  if (next.collection && typeof next.collection === "object") {
    const renamed = {};
    Object.entries(next.collection).forEach(([dealId, items]) => {
      renamed[dealId] = {};
      Object.entries(items || {}).forEach(([name, v]) => {
        const key = COLLECTION_RENAMES[name] || name;
        const prev = renamed[dealId][key];
        renamed[dealId][key] = prev
          ? { ...prev, ...v, note: [prev.note, v.note].filter(Boolean).join(" / ") }
          : v;
      });
    });
    next.collection = renamed;
  }

  // 이미 새 구조로 저장된 이행 현황 데이터의 옛 항목명 정리 (이름 변경 + 항목 분리)
  if (next.fulfillment && typeof next.fulfillment === "object") {
    const fixed = {};
    Object.entries(next.fulfillment).forEach(([dealId, items]) => {
      const out = {};
      const add = (key, v) => {
        out[key] = out[key] ? { ...out[key], ...v, note: [out[key].note, v.note].filter(Boolean).join(" / ") } : { ...v };
      };
      Object.entries(items || {}).forEach(([name, v]) => {
        if (FULFILLMENT_SPLITS[name]) FULFILLMENT_SPLITS[name].forEach((target) => add(target, v));
        else add(FULFILLMENT_RENAMES[name] || name, v);
      });
      fixed[dealId] = out;
    });
    next.fulfillment = fixed;
  }
  return next;
}

const LS_KEY = "cr_dashboard_state_v1";

// 현재 배포된 Google Apps Script 웹앱 URL (기본값)
const DEFAULT_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbxOBV0E4QyD2LZslLdaD4SGcMGV4yiOt7YJ52BXr1bkxjoUhfGIKpuc0FEA-siZ6NACGA/exec";

// 예전에 쓰던 URL — 브라우저(LocalStorage)나 JSON 백업에 남아 있으면 새 URL로 자동 교체
const OLD_WEBHOOK_URLS = [
  "https://script.google.com/macros/s/AKfycbzmYfL4JX3ryab-NQvRRFC9MtQc-bo90Jl5xIZOXzdoTz1dwmlpl5p94IzLwn2bPhTh4A/exec",
];

function normalizeSheetConfig(cfg) {
  const url = (cfg && typeof cfg.webhookUrl === "string" ? cfg.webhookUrl : "").trim();
  if (!url || OLD_WEBHOOK_URLS.includes(url)) return { ...(cfg || {}), webhookUrl: DEFAULT_WEBHOOK_URL };
  return { ...(cfg || {}), webhookUrl: url };
}

/* SYNC-ENGINE-START */
/* -------------------------------------------------------------------------
   구글 시트 ↔ 앱 동기화 엔진 (엑셀 구조 그대로)
   · 팀원 탭(명우·가연·세진·윤서·채현·재민): 주제 | 현황 | 기업명 | 브랜드명 | 연락처 | 한줄설명
   · 패밀리 탭: 협업 기수 | 뉴스레터 현황 | 현황 | 기업명 | 브랜드명 | 연락처 | 한줄설명
   · 전체 오거나이저 탭: 이름 | 현황 | 기업명 | 브랜드명 | 연락처 | 한줄설명
       - 팀원 탭에 이미 있는 기업(복사본)은 건너뛰고, 거기에만 있는 기업(예: 119REO)은 읽어 옵니다.
       - 앱에서 [타 부서 제안]으로 등록한 기업은 이 탭 맨 아래 빈 행에 이름(제안자)과 함께 기록됩니다.
   · 상태 탭(발송 완료·회신·체결 의사·체결 완료·거절)은 수식 탭이라 읽지도 쓰지도 않습니다.
   원칙: 시트가 기준. 앱은 "내가 마지막으로 본 시트 내용(base)"과 비교해 내가 바꾼 칸만 보냅니다.
------------------------------------------------------------------------- */
const SYNC_V = 3;
const MASTER_TAB_NAME = "전체 오거나이저";
const FAMILY_TAB_NAME = "패밀리";
const MEMBER_TABS_DEFAULT = ["명우", "가연", "세진", "윤서", "채현", "재민"];
const SHEET_STATUS_LABEL = { "발송완료": "발송 완료", "체결의사": "체결 의사", "체결완료": "체결 완료" };
const FAMILY_STATUS_OPTIONS = [...STATUS_OPTIONS, "블랙리스트"];
const BULK_CLEAR_CONFIRM = 8; // 한 번에 이 개수 이상의 시트 행을 비우게 되면 확인을 받음

const S = (x) => (x === null || x === undefined ? "" : String(x));

function toSheetStatus(status) {
  return SHEET_STATUS_LABEL[status] || status || "컨택 전";
}
function fromSheetStatus(raw, allowed = STATUS_OPTIONS) {
  const compact = S(raw).replace(/\s+/g, "");
  return allowed.includes(compact) ? compact : "컨택 전";
}
function topicToCategory(raw) {
  const t = S(raw).replace(/\s+/g, "");
  if (t === "주제관련" || t === "주제관련기업") return "주제관련기업";
  if (t === "사회적기업") return "사회적기업";
  return "일반기업";
}
function categoryToTopic(cat) {
  return cat === "주제관련기업" ? "주제관련" : cat === "사회적기업" ? "사회적기업" : "";
}

// 비교용 키: 공백·대소문자·'(주)'/'주식회사' 표기 차이를 무시
function keyNorm(v) {
  return S(v).replace(/\(주\)|주식회사/g, "").replace(/\s+/g, "").toLowerCase();
}
function dupKeyOf(brand, company) {
  return `${keyNorm(company)}|${keyNorm(brand)}`;
}
function stripOwnerPrefix(label) {
  return S(label).replace(/^\s*\[[^\]]*\]\s*/, "").trim();
}
const rowKey = (tab, row) => `${tab}#${row}`;

function orgOfCompany(c, organizers) {
  return c.source && c.source.type === "organizer" ? (organizers || []).find((o) => o.id === c.source.key) || null : null;
}
function companyPerson(c, organizers) {
  const o = orgOfCompany(c, organizers);
  if (o) return o.name;
  if (c.proposerName && S(c.proposerName).trim()) return S(c.proposerName).trim();
  return stripOwnerPrefix(c.ownerLabel);
}

/* 행 ↔ 항목 변환 -------------------------------------------------------- */

// 시트 행 → 앱 필드
function fieldsFromRow(kind, v) {
  if (kind === "family") {
    return {
      generation: S(v[0]), newsletter: S(v[1]), status: fromSheetStatus(v[2], FAMILY_STATUS_OPTIONS),
      companyName: S(v[3]), brandName: S(v[4]), contact: S(v[5]), note: S(v[6]),
    };
  }
  const f = {
    status: fromSheetStatus(v[1]), companyName: S(v[2]), brandName: S(v[3]), contact: S(v[4]), description: S(v[5]),
  };
  if (kind === "member") f.category = topicToCategory(v[0]);
  return f;
}

// 앱 항목 → 시트 행 (원래 시트에 있던 표기는 값이 같으면 그대로 보존)
function rowFromItem(item, kind, baseV, organizers) {
  const b = baseV || [];
  if (kind === "family") {
    const st = fromSheetStatus(b[2], FAMILY_STATUS_OPTIONS) === item.status && S(b[2]) !== "" ? S(b[2]) : toSheetStatus(item.status);
    return [S(item.generation), S(item.newsletter), st, S(item.companyName), S(item.brandName), S(item.contact), S(item.note)];
  }
  const st = baseV && fromSheetStatus(b[1]) === item.status && S(b[1]) !== "" ? S(b[1]) : toSheetStatus(item.status);
  let first;
  if (kind === "master") {
    first = S(item.proposerName).trim() || S(b[0]) || companyPerson(item, organizers);
  } else {
    first = baseV && topicToCategory(b[0]) === item.category ? S(b[0]) : categoryToTopic(item.category);
  }
  return [first, st, S(item.companyName), S(item.brandName), S(item.contact), S(item.description)];
}

// 변경 여부 비교용 값 묶음
function tupleOfRow(kind, v) {
  const f = fieldsFromRow(kind, v);
  if (kind === "family") return [f.generation, f.newsletter, f.status, f.companyName, f.brandName, f.contact, f.note].join("\u0001");
  const first = kind === "master" ? S(v[0]) : f.category;
  return [first, f.status, f.companyName, f.brandName, f.contact, f.description].join("\u0001");
}
function tupleOfItem(item, kind, baseV, organizers) {
  if (kind === "family") {
    return [S(item.generation), S(item.newsletter), item.status, S(item.companyName), S(item.brandName), S(item.contact), S(item.note)].join("\u0001");
  }
  const first = kind === "master" ? rowFromItem(item, kind, baseV, organizers)[0] : item.category;
  return [first, item.status, S(item.companyName), S(item.brandName), S(item.contact), S(item.description)].join("\u0001");
}

function hasRowContent(kind, v) {
  const idx = kind === "family" ? [0, 1, 3, 4, 5, 6] : [2, 3, 4, 5];
  return idx.some((i) => S(v[i]).trim() !== "");
}

/* 앱 전용 정보(extras): 시트에 열이 없는 항목은 _RawData 에 보관했다가 다시 붙여 줌 --------------- */

function extrasKeyBase(tab, brand, company) {
  return `${tab}|${keyNorm(brand)}|${keyNorm(company)}`;
}

function buildExtras(companies, familyPartners) {
  const out = { companies: {}, family: {} };
  const seen = {};
  const put = (bucket, items, pick) => {
    items
      .filter((it) => it.sheet)
      .slice()
      .sort((a, b) => (a.sheet.tab === b.sheet.tab ? a.sheet.row - b.sheet.row : a.sheet.tab < b.sheet.tab ? -1 : 1))
      .forEach((it) => {
        const k0 = `${bucket}:` + extrasKeyBase(it.sheet.tab, it.brandName, it.companyName);
        seen[k0] = (seen[k0] || 0) + 1;
        out[bucket][seen[k0] > 1 ? `${k0.slice(bucket.length + 1)}#${seen[k0]}` : k0.slice(bucket.length + 1)] = pick(it);
      });
  };
  put("companies", companies, (c) => ({
    id: c.id, appeal: c.appeal || "", category: c.category, proposerName: c.proposerName || "",
    ownerLabel: c.ownerLabel || "", srcType: c.source?.type || "", srcKey: c.source?.key || "",
  }));
  put("family", familyPartners, (f) => ({ id: f.id, collabCount: f.collabCount || "", manager: f.manager || "" }));
  return out;
}

/* 핵심: 3자 병합 (내 앱의 현재 상태 · 마지막으로 본 시트 내용 · 지금 시트) ------------------------- */

function reconcileSheet(local, base, server, extras, opts = {}) {
  const notices = [];
  const ops = [];
  let dirty = false;
  const stats = { imported: 0, fromSheet: 0, removed: 0, conflicts: 0, unlinked: 0, pushed: 0, cleared: 0, mirror: 0 };

  const tabs = {};
  (server.tabs || []).forEach((t) => { tabs[t.name] = t; });
  const srow = {};
  (server.tabs || []).forEach((t) => t.rows.forEach((r) => { srow[rowKey(t.name, r.r)] = { tab: t.name, kind: t.kind, r: r.r, v: r.v, sig: r.sig }; }));

  // 안전장치: 시트 탭이 갑자기 통째로 비어 보이면(탭은 있는데 행이 0개) 앱 데이터를 유지
  const guardedTabs = new Set();
  (server.tabs || []).forEach((t) => {
    const baseCount = Object.keys(base || {}).filter((k) => k.startsWith(t.name + "#")).length;
    if (t.rows.length === 0 && baseCount >= 5) {
      guardedTabs.add(t.name);
      notices.push({ level: "warn", text: `'${t.name}' 탭이 비어 있어(이전 ${baseCount}행) 앱의 데이터를 그대로 유지했습니다.` });
    }
  });

  /* 1) 오거나이저 ↔ 팀원 탭 연결 */
  let organizers = (local.organizers || []).map((o) => ({ ...o }));
  const memberTabs = (server.tabs || []).filter((t) => t.kind === "member").map((t) => t.name);
  memberTabs.forEach((name) => {
    let o = organizers.find((x) => x.sheetTab === name) || organizers.find((x) => !x.sheetTab && keyNorm(x.name) === keyNorm(name));
    if (!o) {
      o = { id: `org-${name}`, name, sheetTab: name };
      organizers.push(o);
    } else if (o.sheetTab !== name) {
      o.sheetTab = name;
    }
  });
  const orgBefore = JSON.stringify(local.organizers || []);
  const usedOrgIds = new Set((local.companies || []).map((c) => c.source && c.source.key));
  if (memberTabs.length > 0) {
    organizers = organizers.filter((o) => o.sheetTab || !DEFAULT_ORGANIZERS_OLD.includes(o.name) || usedOrgIds.has(o.id));
  }
  const orgByTab = {};
  organizers.forEach((o) => { if (o.sheetTab) orgByTab[o.sheetTab] = o; });

  // 전체 오거나이저의 복사본 판별: 팀원 탭에 같은 브랜드명 또는 같은 기업명이 이미 있으면 복사본으로 봄
  const memberBrands = new Set();
  const memberCompanies = new Set();
  (server.tabs || []).filter((t) => t.kind === "member").forEach((t) =>
    t.rows.forEach((r) => {
      if (keyNorm(r.v[3])) memberBrands.add(keyNorm(r.v[3]));
      if (keyNorm(r.v[2])) memberCompanies.add(keyNorm(r.v[2]));
    })
  );
  const isMirror = (v) => (keyNorm(v[3]) && memberBrands.has(keyNorm(v[3]))) || (keyNorm(v[2]) && memberCompanies.has(keyNorm(v[2])));

  const tabOf = (item, itemKind) => {
    if (itemKind === "family") return tabs[FAMILY_TAB_NAME] ? FAMILY_TAB_NAME : null;
    const o = orgOfCompany(item, organizers);
    if (o) return o.sheetTab && (tabs[o.sheetTab] || opts.canCreateTabs !== false) ? o.sheetTab : null;
    if (item.source && item.source.type === "dept") return tabs[MASTER_TAB_NAME] ? MASTER_TAB_NAME : null;
    return null;
  };
  const kindOfTabName = (name, itemKind) => (itemKind === "family" ? "family" : name === MASTER_TAB_NAME ? "master" : "member");

  const newBase = {};
  const consumed = new Set(); // 항목이 가리키고 있는 시트 행

  // 서버에 없는 탭의 base 는 그대로 보존
  Object.keys(base || {}).forEach((k) => {
    const tab = k.slice(0, k.lastIndexOf("#"));
    if (!tabs[tab]) newBase[k] = base[k];
  });

  const pendingAppend = [];

  function processList(items, itemKind) {
    const kept = [];
    items.forEach((item0) => {
      let item = item0;
      let ref = item.sheet || null;
      const target = tabOf(item, itemKind);

      if (ref && !tabs[ref.tab]) { // 시트에서 해당 탭을 못 찾음 → 건드리지 않음
        kept.push(item);
        return;
      }

      // 오거나이저를 바꿔 다른 팀원 탭으로 옮겨진 경우: 옛 행은 비우고 새 탭에 추가
      if (ref && itemKind === "company" && tabs[ref.tab].kind === "member" && target && target !== ref.tab) {
        const k = rowKey(ref.tab, ref.row);
        const s = srow[k];
        const b = base && base[k];
        if (s && b && tupleOfRow("member", s.v) === tupleOfRow("member", b.v)) {
          ops.push({ id: `clear:${k}`, type: "clear", tab: ref.tab, row: ref.row, expect: s.sig });
          stats.cleared += 1;
        } else if (s) {
          notices.push({ level: "warn", text: `'${ref.tab}' ${ref.row}행은 시트에서 바뀌어 있어 옛 행을 지우지 않았습니다. (${item.brandName || item.companyName})` });
        }
        item = { ...item, sheet: null };
        ref = null;
        dirty = true;
      }

      if (ref) {
        const k = rowKey(ref.tab, ref.row);
        const tab = tabs[ref.tab];
        const kind = tab.kind;
        const s = srow[k];
        const b = base && base[k];

        if (guardedTabs.has(ref.tab)) { kept.push(item); if (b) newBase[k] = b; consumed.add(k); return; }

        if (!b) {
          // 마지막으로 본 기록이 없음(예: 예전 버전 백업) → 시트 내용과 같으면 연결, 다르면 시트 우선
          if (s) {
            consumed.add(k);
            newBase[k] = { sig: s.sig, v: s.v };
            if (tupleOfRow(kind, s.v) !== tupleOfItem(item, kind, s.v, organizers)) {
              item = applyRowToItem(item, kind, s.v);
              stats.fromSheet += 1;
              dirty = true;
            }
            kept.push(item);
          } else {
            kept.push({ ...item, sheet: null });
            dirty = true;
          }
          return;
        }

        if (!s) { // 시트에서 이 행이 사라짐(지워짐)
          const changed = tupleOfItem(item, kind, b.v, organizers) !== tupleOfRow(kind, b.v);
          if (!changed) { stats.removed += 1; dirty = true; return; }
          notices.push({ level: "warn", text: `시트에서 지워진 행을 앱에서 고쳐 두셨습니다. 새 행으로 다시 추가합니다. (${item.brandName || item.companyName})` });
          kept.push({ ...item, sheet: null });
          dirty = true;
          return;
        }

        consumed.add(k);
        const tb = tupleOfRow(kind, b.v);
        const ts = tupleOfRow(kind, s.v);
        const tl = tupleOfItem(item, kind, b.v, organizers);

        if (tl === tb) {
          if (ts !== tb) { item = applyRowToItem(item, kind, s.v); stats.fromSheet += 1; dirty = true; }
          newBase[k] = { sig: s.sig, v: s.v };
          kept.push(item);
        } else if (ts === tb) {
          // 내가 바꾼 칸만 시트에 반영
          newBase[k] = { sig: s.sig, v: s.v };
          ops.push({ id: `upd:${itemKind}:${item.id}`, type: "update", tab: ref.tab, row: ref.row, expect: s.sig, v: rowFromItem(item, kind, s.v, organizers) });
          stats.pushed += 1;
          kept.push(item);
        } else if (tl === ts) {
          newBase[k] = { sig: s.sig, v: s.v };
          kept.push(item);
        } else {
          // 나도 바꾸고 다른 사람도 같은 행을 바꿈 → 시트 내용을 따름
          item = applyRowToItem(item, kind, s.v);
          newBase[k] = { sig: s.sig, v: s.v };
          stats.conflicts += 1;
          dirty = true;
          notices.push({ level: "warn", text: `'${ref.tab}' ${ref.row}행(${item.brandName || item.companyName})을 다른 사람이 먼저 수정해 시트 내용으로 맞췄습니다.` });
          kept.push(item);
        }
        return;
      }

      // 아직 시트에 없는 항목 → 추가 대기
      if (!target) {
        stats.unlinked += 1;
        kept.push(item);
        return;
      }
      const kind = kindOfTabName(target, itemKind);
      const probe = rowFromItem(item, kind, null, organizers);
      if (!hasRowContent(kind, probe)) { kept.push(item); return; }
      pendingAppend.push({ item, itemKind, target, kind, index: kept.length });
      kept.push(item);
    });
    return kept;
  }

  let companies = processList(local.companies || [], "company");
  let familyPartners = processList(local.familyPartners || [], "family");

  /* 2) 직접 지운 항목: 시트 행도 비움 (시트에서 그 사이 바뀌지 않았을 때만) */
  const restore = [];
  Object.keys(base || {}).forEach((k) => {
    const tabName = k.slice(0, k.lastIndexOf("#"));
    const tab = tabs[tabName];
    if (!tab || consumed.has(k) || guardedTabs.has(tabName)) return;
    const s = srow[k];
    if (!s) return; // 이미 시트에서도 사라짐
    if (tupleOfRow(tab.kind, s.v) === tupleOfRow(tab.kind, base[k].v)) {
      if (opts.keepDeleted) restore.push(k);
      else if (!ops.some((o) => o.tab === tabName && o.row === s.r && o.type === "clear")) {
        ops.push({ id: `clear:${k}`, type: "clear", tab: tabName, row: s.r, expect: s.sig });
        stats.cleared += 1;
        newBase[k] = base[k]; // 결과 확인 전까지 유지
        consumed.add(k);
      }
    }
  });

  /* 3) 시트에만 있는 행 → 앱에 새로 추가 */
  const occ = {};
  const importedKeys = new Set();
  const adoptedRows = new Set();
  const unref = (t) => t.rows.filter((r) => !consumed.has(rowKey(t.name, r.r)));

  // 3-0) 앱에서 방금 만든 항목이 이미 시트에 있으면(응답을 못 받은 재시도 등) 새로 추가하지 않고 연결
  const stillAppend = [];
  pendingAppend.forEach((p) => {
    const t = tabs[p.target];
    const hit = t && t.rows.find((r) => !consumed.has(rowKey(t.name, r.r)) && !adoptedRows.has(rowKey(t.name, r.r)) &&
      tupleOfRow(p.kind, r.v) === tupleOfItem(p.item, p.kind, r.v, organizers));
    if (hit) {
      const k = rowKey(t.name, hit.r);
      adoptedRows.add(k);
      consumed.add(k);
      newBase[k] = { sig: hit.sig, v: hit.v };
      const list = p.itemKind === "family" ? familyPartners : companies;
      const idx = list.findIndex((x) => x.id === p.item.id);
      if (idx >= 0) list[idx] = { ...list[idx], sheet: { tab: t.name, row: hit.r } };
      dirty = true;
    } else stillAppend.push(p);
  });
  pendingAppend.length = 0;
  stillAppend.forEach((p) => {
    ops.push({
      id: `add:${p.itemKind}:${p.item.id}`, type: "append", tab: p.target, createTab: p.kind === "member", v: rowFromItem(p.item, p.kind, null, organizers),
    });
    stats.pushed += 1;
  });

  const ex = extras || { companies: {}, family: {} };
  const takeExtra = (bucket, tab, brand, company) => {
    const base0 = extrasKeyBase(tab, brand, company);
    const ok = `${bucket}:${base0}`;
    occ[ok] = (occ[ok] || 0) + 1;
    return (ex[bucket] || {})[occ[ok] > 1 ? `${base0}#${occ[ok]}` : base0] || null;
  };
  const knownIds = new Set([...companies, ...familyPartners].map((x) => x.id));
  const freshId = (cand, prefix) => (cand && !knownIds.has(cand) ? (knownIds.add(cand), cand) : (() => { const n = uid(prefix); knownIds.add(n); return n; })());

  (server.tabs || []).forEach((t) => {
    if (guardedTabs.has(t.name)) return;
    // 이름 순서 보존을 위해 extras 발생 횟수는 모든 행에 대해 센다
    t.rows.forEach((r) => {
      const k = rowKey(t.name, r.r);
      const bucket = t.kind === "family" ? "family" : "companies";
      const e = takeExtra(bucket, t.name, t.kind === "family" ? r.v[4] : r.v[3], t.kind === "family" ? r.v[3] : r.v[2]);
      if (consumed.has(k)) return;
      if (restore.includes(k)) { /* 삭제 취소 */ }

      if (t.kind === "master" && isMirror(r.v)) { stats.mirror += 1; return; } // 팀원 탭의 복사본

      const f = fieldsFromRow(t.kind, r.v);
      let item;
      if (t.kind === "family") {
        item = emptyFamily({ ...f, id: freshId(e && e.id, "fam"), collabCount: (e && e.collabCount) || "1회", manager: (e && e.manager) || "", sheet: { tab: t.name, row: r.r } });
      } else if (t.kind === "member") {
        const o = orgByTab[t.name];
        item = emptyCompany({
          ...f, id: freshId(e && e.id, "co"), appeal: (e && e.appeal) || "", proposerName: "",
          source: { type: "organizer", key: o ? o.id : "" }, ownerLabel: `[대외협력팀] ${o ? o.name : t.name}`, sheet: { tab: t.name, row: r.r },
        });
      } else {
        const person = S(r.v[0]).trim();
        const o = organizers.find((x) => person && (keyNorm(person) === keyNorm(x.name) || (keyNorm(x.name).length >= 2 && keyNorm(person).endsWith(keyNorm(x.name)))));
        if (o) {
          item = emptyCompany({
            ...f, id: freshId(e && e.id, "co"), category: (e && e.category) || "일반기업", appeal: (e && e.appeal) || "", proposerName: "",
            source: { type: "organizer", key: o.id }, ownerLabel: `[대외협력팀] ${o.name}`, sheet: { tab: t.name, row: r.r },
          });
        } else {
          const dept = e && e.srcType === "dept" && e.srcKey ? e.srcKey : DEPARTMENTS[0];
          item = emptyCompany({
            ...f, id: freshId(e && e.id, "co"), category: (e && e.category) || "일반기업", appeal: (e && e.appeal) || "", proposerName: person,
            source: { type: "dept", key: dept }, ownerLabel: `[${dept}] ${person}`, sheet: { tab: t.name, row: r.r },
          });
        }
      }
      if (t.kind === "family") familyPartners.push(item); else companies.push(item);
      newBase[k] = { sig: r.sig, v: r.v };
      importedKeys.add(k);
      stats.imported += 1;
      dirty = true;
    });
  });

  if (JSON.stringify(organizers) !== orgBefore) dirty = true;
  return { companies, familyPartners, organizers, base: newBase, ops, notices, stats, changed: dirty };
}

// 시트 행의 내용을 항목에 반영 (시트에 없는 앱 전용 항목은 그대로 유지)
function applyRowToItem(item, kind, v) {
  const f = fieldsFromRow(kind, v);
  const next = { ...item, ...f };
  if (kind === "master" && item.source && item.source.type === "dept") next.proposerName = S(v[0]).trim();
  return next;
}

// 저장 요청 결과 반영: 새로 만든 행의 번호(refs), 갱신된 base, 안내 문구, 다시 시도 여부
function applyOpResults(ops, results, base) {
  const nb = { ...base };
  const refs = {}; // 항목 id -> {tab,row}
  const notices = [];
  let retry = false;
  let appended = 0;
  const byId = {};
  (results || []).forEach((r) => { byId[r.id] = r; });
  ops.forEach((op) => {
    const r = byId[op.id];
    if (!r) { retry = true; return; }
    if (!r.ok) {
      if (r.conflict) { retry = true; return; }
      notices.push({ level: "warn", text: r.error || "저장하지 못한 항목이 있습니다." });
      return;
    }
    if (r.warn) notices.push({ level: "warn", text: r.warn });
    const k = rowKey(op.tab, r.row);
    if (op.type === "clear") { delete nb[k]; return; }
    nb[k] = { sig: r.sig, v: r.v };
    if (op.type === "append") {
      refs[op.id.split(":").slice(2).join(":")] = { tab: op.tab, row: r.row };
      appended += 1;
    }
  });
  return { refs, base: nb, notices, retry, appended };
}
/* SYNC-ENGINE-END */


/* =========================================================================
   유틸
========================================================================= */

let __uidCounter = 0;
function uid(prefix = "id") {
  __uidCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${__uidCounter}_${Math.random().toString(36).slice(2, 7)}`;
}

function won(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("ko-KR") + "원";
}

// 기업명 자동 '(주) ' 접두사 정제: 이미 '(주)' 또는 '주식회사'로 시작하면 그대로 두고, 아니면 앞에 붙여줌
function normalizeCompanyName(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return trimmed;
  if (/^\(주\)\s*/.test(trimmed) || /^주식회사\s*/.test(trimmed)) return trimmed;
  return `(주) ${trimmed}`;
}

function emptyCompany(overrides = {}) {
  return {
    id: uid("co"),
    category: "일반기업",
    status: "컨택 전",
    companyName: "",
    brandName: "",
    contact: "",
    description: "",
    appeal: "",
    sheet: null, // 구글 시트 위치 { tab, row }
    ...overrides,
  };
}

function emptyFamily(overrides = {}) {
  return {
    id: uid("fam"),
    generation: "",
    newsletter: "",
    collabCount: "1회",
    status: "컨택 전",
    companyName: "",
    brandName: "",
    contact: "",
    note: "",
    manager: "",
    sheet: null,
    ...overrides,
  };
}

function emptyDeal(overrides = {}) {
  return {
    id: uid("deal"),
    brandName: "",
    managerName: "",
    confirmDate: "",
    grade: "LITE",
    optionKey: "opt1",
    inKindOnlyAmount: 0,
    earlyBird: false,
    earlyBirdDeadline: "",
    isFamilyPartner: false,
    familyCollabCount: "1회",
    actualCash: 0,
    actualInKind: 0,
    inKindType: "",
    inKindSize: { w: "", h: "", d: "" },
    paymentStatus: "대기",
    deliveryStatus: "대기",
    vipInfo: { visitBrand: "", gradeName: "", personName: "", contact: "" },
    sourceCompanyId: null,
    ...overrides,
  };
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function saveToLocalStorage(state) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

/* =========================================================================
   Context
========================================================================= */

const AppCtx = createContext(null);
function useApp() {
  return useContext(AppCtx);
}

/* =========================================================================
   공용 소형 컴포넌트
========================================================================= */

function StatusSelect({ value, onChange, options = STATUS_OPTIONS }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`text-xs font-semibold rounded-full px-2.5 py-1 border outline-none cursor-pointer ${STATUS_STYLES[value] || ""}`}
    >
      {(options.includes(value) ? options : [...options, value]).map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}

function IconBtn({ onClick, title, children, danger }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md border transition-colors ${
        danger
          ? "border-rose-200 text-rose-500 hover:bg-rose-50"
          : "border-slate-200 text-slate-500 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function SectionCard({ title, icon, right, children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>
      {(title || right) && (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            {icon}
            <span>{title}</span>
          </div>
          <div>{right}</div>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

function EmptyRow({ colSpan, text }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center text-slate-400 text-sm py-10">
        {text}
      </td>
    </tr>
  );
}

/* =========================================================================
   중복 브랜드 경고 훅
========================================================================= */

function useDuplicateWarning() {
  const { allBrandNames } = useApp();
  return useCallback(
    (brandName, excludeId) => {
      const name = (brandName || "").trim();
      if (!name) return null;
      const hit = allBrandNames.find((b) => b.name === name && b.id !== excludeId);
      return hit ? name : null;
    },
    [allBrandNames]
  );
}

/* =========================================================================
   기업 입력 폼 (Tab1, Tab2 공용 베이스)
========================================================================= */

function CompanyForm({ onSubmit, initial, submitLabel = "추가하기", showProposerField = false }) {
  const checkDup = useDuplicateWarning();
  const [form, setForm] = useState(
    initial || { ...emptyCompany(), proposerName: "" }
  );
  const dup = checkDup(form.brandName, form.id);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function submit() {
    if (!form.companyName.trim() && !form.brandName.trim()) return;
    if (showProposerField && !(form.proposerName || "").trim()) {
      alert("제안자 이름을 입력해주세요.");
      return;
    }
    const normalized = { ...form, companyName: normalizeCompanyName(form.companyName) };
    onSubmit(normalized);
    if (!initial) setForm({ ...emptyCompany(), proposerName: "" });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 rounded-xl p-4 border border-slate-200">
      {showProposerField && (
        <div className="md:col-span-2">
          <label className="text-xs font-semibold text-slate-500">제안자 이름 <span className="text-rose-400">*필수</span></label>
          <input
            className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.proposerName || ""}
            onChange={(e) => update("proposerName", e.target.value)}
            placeholder="예: 한수아"
          />
        </div>
      )}
      <div>
        <label className="text-xs font-semibold text-slate-500">기업 구분</label>
        <select
          className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={form.category}
          onChange={(e) => update("category", e.target.value)}
        >
          {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500">현황</label>
        <div className="mt-1">
          <StatusSelect value={form.status} onChange={(v) => update("status", v)} />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500">기업명 <span className="text-slate-400 font-normal">(한글로 띄어쓰기 없이 입력 / 입력 후 '(주)' 자동 완성)</span></label>
        <input
          className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={form.companyName}
          onChange={(e) => update("companyName", e.target.value)}
          onBlur={(e) => update("companyName", normalizeCompanyName(e.target.value))}
          placeholder="예: 모빌테크 (mobiltech X)"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500">브랜드명 <span className="text-slate-400 font-normal">(한글로 띄어쓰기 없이 입력)</span></label>
        <input
          className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={form.brandName}
          onChange={(e) => update("brandName", e.target.value)}
          placeholder="예: 모빌테크"
        />
        {dup && (
          <p className="text-rose-600 text-xs font-bold mt-1">
            ⚠️ [{dup}]은 이미 등록된 브랜드입니다. 중복 컨택에 유의하세요!
          </p>
        )}
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500">연락처 (메일 / 창구)</label>
        <input
          className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={form.contact}
          onChange={(e) => update("contact", e.target.value)}
          placeholder="example@company.com"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500">기업 설명</label>
        <input
          className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
        />
      </div>
      <div className="md:col-span-2">
        <label className="text-xs font-semibold text-slate-500">어필 포인트 및 주제 연관성</label>
        <textarea
          className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          rows={2}
          value={form.appeal}
          onChange={(e) => update("appeal", e.target.value)}
        />
      </div>
      <div className="md:col-span-2 flex justify-end">
        <button
          onClick={submit}
          className="flex items-center gap-1.5 bg-slate-900 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-slate-700"
        >
          <Plus size={16} /> {submitLabel}
        </button>
      </div>
    </div>
  );
}

// 긴 텍스트를 한 줄로 자르고, 호버 시 말풍선 툴팁으로 전체 내용을 보여주는 셀
function TruncateTooltip({ text }) {
  if (!text || !text.trim()) return <span className="text-slate-300">-</span>;
  return (
    <div className="group relative max-w-[170px]">
      <p className="truncate">{text}</p>
      <div
        className="pointer-events-none absolute left-0 top-full z-30 mt-1.5 w-72 max-w-[80vw] rounded-lg bg-slate-900 p-3 text-xs leading-relaxed text-white opacity-0 shadow-xl transition-opacity duration-150 whitespace-pre-wrap group-hover:opacity-100"
      >
        {text}
      </div>
    </div>
  );
}

// 기업 상세 정보를 큰 폰트로 보고 그 자리에서 수정하는 모달
function CompanyDetailModal({ company, onUpdate, onClose }) {
  if (!company) return null;
  function patch(p) { onUpdate(company.id, p); }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-black text-slate-800">기업 상세 정보</h3>
            {company.ownerLabel && (
              <p className="text-xs text-slate-400 mt-0.5">등록자/부서 · <span className="font-semibold text-slate-600">{company.ownerLabel}</span></p>
            )}
          </div>
          <IconBtn title="닫기" onClick={onClose}><X size={16} /></IconBtn>
        </div>

        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400">기업 구분</label>
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
                value={company.category}
                onChange={(e) => patch({ category: e.target.value })}
              >
                {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400">현황</label>
              <div className="mt-1"><StatusSelect value={company.status} onChange={(v) => patch({ status: v })} /></div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400">기업명</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-lg font-bold"
              value={company.companyName}
              onChange={(e) => patch({ companyName: e.target.value })}
              onBlur={(e) => patch({ companyName: normalizeCompanyName(e.target.value) })}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400">브랜드명</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-lg font-bold"
              value={company.brandName}
              onChange={(e) => patch({ brandName: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400">연락처 (메일 / 창구)</label>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base"
              value={company.contact}
              onChange={(e) => patch({ contact: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400">기업 설명</label>
            <textarea
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base leading-relaxed"
              value={company.description}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400">어필 포인트 및 주제 연관성</label>
            <textarea
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base leading-relaxed"
              value={company.appeal}
              onChange={(e) => patch({ appeal: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function CompanyTable({ rows, onUpdate, onDelete, showOwnerCol }) {
  const [detailId, setDetailId] = useState(null);
  const detailCompany = rows.find((r) => r.id === detailId) || null;

  return (
    <div className="overflow-x-auto mt-4 rounded-xl border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-xs">
          <tr>
            {showOwnerCol && <th className="text-left px-3 py-2">등록자/부서</th>}
            <th className="text-left px-3 py-2">구분</th>
            <th className="text-left px-3 py-2">현황</th>
            <th className="text-left px-3 py-2">기업명</th>
            <th className="text-left px-3 py-2">브랜드명</th>
            <th className="text-left px-3 py-2">연락처</th>
            <th className="text-left px-3 py-2">설명</th>
            <th className="text-left px-3 py-2">어필포인트</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <EmptyRow colSpan={showOwnerCol ? 9 : 8} text="등록된 기업이 없습니다." />}
          {rows.map((r) => (
            <tr
              key={r.id}
              className={`border-t border-slate-100 ${
                r.status === "거절" ? "bg-rose-50/60" : r.status === "체결완료" ? "bg-emerald-50/60" : ""
              }`}
            >
              {showOwnerCol && <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{r.ownerLabel}</td>}
              <td className="px-3 py-2">
                <select
                  className="text-xs rounded-md border border-slate-200 px-1.5 py-1"
                  value={r.category}
                  onChange={(e) => onUpdate(r.id, { category: e.target.value })}
                >
                  {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </td>
              <td className="px-3 py-2">
                <StatusSelect value={r.status} onChange={(v) => onUpdate(r.id, { status: v })} />
              </td>
              <td className="px-3 py-2 min-w-[150px] max-w-[190px]">
                <button
                  className="group flex w-full items-center gap-1 text-left"
                  title="상세 보기 / 수정"
                  onClick={() => setDetailId(r.id)}
                >
                  <span className="truncate font-medium group-hover:text-rose-600 group-hover:underline">
                    {r.companyName || "(기업명 없음)"}
                  </span>
                  <ExternalLink size={12} className="shrink-0 text-slate-300 group-hover:text-rose-500" />
                </button>
              </td>
              <td className="px-3 py-2 min-w-[110px]">
                <input
                  className="w-full bg-transparent outline-none font-medium"
                  value={r.brandName}
                  onChange={(e) => onUpdate(r.id, { brandName: e.target.value })}
                />
              </td>
              <td className="px-3 py-2 min-w-[130px]">
                <input
                  className="w-full bg-transparent outline-none text-xs"
                  value={r.contact}
                  onChange={(e) => onUpdate(r.id, { contact: e.target.value })}
                />
              </td>
              <td className="px-3 py-2 max-w-[170px]">
                <TruncateTooltip text={r.description} />
              </td>
              <td className="px-3 py-2 max-w-[170px]">
                <TruncateTooltip text={r.appeal} />
              </td>
              <td className="px-3 py-2">
                <IconBtn danger title="삭제" onClick={() => onDelete(r.id)}>
                  <Trash2 size={14} />
                </IconBtn>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {detailCompany && (
        <CompanyDetailModal
          company={detailCompany}
          onUpdate={onUpdate}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}

/* =========================================================================
   TAB 1: 부서별 / 팀원별 기업 서칭 관리
========================================================================= */

function Tab1() {
  const {
    companies, addCompany, updateCompany, deleteCompany,
    organizers, setOrganizers,
  } = useApp();

  const [view, setView] = useState("ALL"); // ALL | DEPT | ORGANIZER
  const [deptTab, setDeptTab] = useState(DEPARTMENTS[0]);
  const [orgTab, setOrgTab] = useState(organizers[0]?.id);
  const [filterOwner, setFilterOwner] = useState("전체");
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    if (!organizers.find((o) => o.id === orgTab)) setOrgTab(organizers[0]?.id);
  }, [organizers]); // eslint-disable-line

  const ownerOptions = useMemo(() => {
    const set = new Set(["전체"]);
    companies.forEach((c) => set.add(c.ownerLabel));
    return Array.from(set);
  }, [companies]);

  const allRows = useMemo(() => {
    return filterOwner === "전체" ? companies : companies.filter((c) => c.ownerLabel === filterOwner);
  }, [companies, filterOwner]);

  function addOrganizer() {
    const name = prompt("새 오거나이저 이름을 입력하세요");
    if (!name) return;
    const n = name.trim();
    if (!n) return;
    if (organizers.some((o) => keyNorm(o.name) === keyNorm(n) || o.sheetTab === n)) { alert("이미 있는 이름입니다."); return; }
    // 구글 시트에 같은 이름의 탭이 없으면 첫 기업을 저장할 때 자동으로 만들어집니다.
    setOrganizers((prev) => [...prev, { id: uid("org"), name: n, sheetTab: n }]);
  }
  function removeOrganizer(id) {
    const target = organizers.find((o) => o.id === id);
    const owned = companies.filter((c) => c.source && c.source.type === "organizer" && c.source.key === id);
    if (target && target.sheetTab && owned.some((c) => c.sheet)) {
      alert(`'${target.name}'은(는) 구글 시트의 '${target.sheetTab}' 탭과 연결되어 있어 앱에서 삭제할 수 없습니다.\n기업을 지우려면 표에서 개별 삭제하고, 탭 자체는 구글 시트에서 정리해주세요.`);
      return;
    }
    if (!confirm("해당 오거나이저 탭과 등록된 기업 데이터가 함께 삭제됩니다. 계속할까요?")) return;
    owned.forEach((c) => deleteCompany(c.id));
    setOrganizers((prev) => prev.filter((o) => o.id !== id));
  }
  function startRename(o) {
    setRenamingId(o.id);
    setRenameValue(o.name);
  }
  function commitRename() {
    setOrganizers((prev) => prev.map((o) => (o.id === renamingId ? { ...o, name: renameValue.trim() || o.name } : o)));
    setRenamingId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          ["ALL", "전체단위 통합 뷰", <Building2 size={15} key="i" />],
          ["DEPT", "타 부서 제안", <Users size={15} key="i" />],
          ["ORGANIZER", "대외협력팀 오거나이저", <Users size={15} key="i" />],
        ].map(([key, label, icon]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              view === key ? "bg-rose-600 text-white border-rose-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {view === "ALL" && (
        <SectionCard
          title="전체단위 통합 뷰"
          icon={<Building2 size={17} className="text-rose-600" />}
          right={
            <select
              className="text-xs rounded-lg border border-slate-300 px-2 py-1.5"
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value)}
            >
              {ownerOptions.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          }
        >
          <p className="text-xs text-slate-400 mb-2">모든 부서 · 모든 오거나이저의 서칭 데이터가 실시간으로 통합됩니다. ({allRows.length}건)</p>
          <CompanyTable
            rows={allRows}
            showOwnerCol
            onUpdate={(id, patch) => updateCompany(id, patch)}
            onDelete={(id) => deleteCompany(id)}
          />
        </SectionCard>
      )}

      {view === "DEPT" && (
        <SectionCard title="타 부서 제안 기업" icon={<Users size={17} className="text-rose-600" />}>
          <div className="flex gap-2 mb-4 flex-wrap">
            {DEPARTMENTS.map((d) => (
              <button
                key={d}
                onClick={() => setDeptTab(d)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                  deptTab === d ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 mb-2">각 팀당 약 5개 내외의 추천 기업을 가볍게 등록하는 공간입니다.</p>
          <CompanyForm
            showProposerField
            onSubmit={(data) =>
              addCompany({
                ...data,
                source: { type: "dept", key: deptTab },
                ownerLabel: `[${deptTab}] ${(data.proposerName || "").trim()}`,
              })
            }
          />
          <CompanyTable
            rows={companies.filter((c) => c.source.type === "dept" && c.source.key === deptTab)}
            onUpdate={(id, patch) => updateCompany(id, patch)}
            onDelete={(id) => deleteCompany(id)}
          />
        </SectionCard>
      )}

      {view === "ORGANIZER" && (
        <SectionCard title="대외협력팀 오거나이저별 서칭" icon={<Users size={17} className="text-rose-600" />}>
          <div className="flex gap-2 mb-4 flex-wrap items-center">
            {organizers.map((o) => (
              <div key={o.id} className="relative group">
                {renamingId === o.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      className="text-xs border border-slate-300 rounded-full px-2.5 py-1.5 w-24"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && commitRename()}
                    />
                    <button onClick={commitRename} className="text-emerald-600"><Check size={16} /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => setOrgTab(o.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                      orgTab === o.id ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"
                    }`}
                  >
                    {o.name}
                    <Pencil
                      size={11}
                      className="opacity-60 hover:opacity-100"
                      onClick={(e) => { e.stopPropagation(); startRename(o); }}
                    />
                    <X
                      size={12}
                      className="opacity-60 hover:opacity-100 hover:text-rose-300"
                      onClick={(e) => { e.stopPropagation(); removeOrganizer(o.id); }}
                    />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={addOrganizer}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border border-dashed border-slate-300 text-slate-500 hover:bg-slate-50"
            >
              <Plus size={13} /> 탭 추가
            </button>
          </div>

          {organizers.find((o) => o.id === orgTab) && (
            <>
              <CompanyForm
                onSubmit={(data) => {
                  const o = organizers.find((x) => x.id === orgTab);
                  addCompany({ ...data, source: { type: "organizer", key: orgTab }, ownerLabel: `[대외협력팀] ${o.name}` });
                }}
              />
              <CompanyTable
                rows={companies.filter((c) => c.source.type === "organizer" && c.source.key === orgTab)}
                onUpdate={(id, patch) => updateCompany(id, patch)}
                onDelete={(id) => deleteCompany(id)}
              />
            </>
          )}
        </SectionCard>
      )}
    </div>
  );
}

/* =========================================================================
   TAB 2: 패밀리 파트너 관리
========================================================================= */

function FamilyForm({ onSubmit }) {
  const checkDup = useDuplicateWarning();
  const { organizers } = useApp();
  const [form, setForm] = useState(emptyFamily());
  const dup = checkDup(form.brandName, form.id);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }
  function submit() {
    if (!form.companyName.trim() && !form.brandName.trim()) return;
    onSubmit(form);
    setForm(emptyFamily());
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 rounded-xl p-4 border border-slate-200">
      <div>
        <label className="text-xs font-semibold text-slate-500">과거 협업 기수</label>
        <input list="family-gen-list" className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={form.generation} placeholder="예: 29, 30기" onChange={(e) => update("generation", e.target.value)} />
        <datalist id="family-gen-list">{GENERATIONS.map((g) => <option key={g} value={g} />)}</datalist>
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500">뉴스레터 현황</label>
        <input className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={form.newsletter || ""} onChange={(e) => update("newsletter", e.target.value)} />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500">협업 횟수</label>
        <select className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={form.collabCount} onChange={(e) => update("collabCount", e.target.value)}>
          {COLLAB_COUNTS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500">현황</label>
        <div className="mt-1"><StatusSelect options={FAMILY_STATUS_OPTIONS} value={form.status} onChange={(v) => update("status", v)} /></div>
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500">기업명</label>
        <input className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={form.companyName} onChange={(e) => update("companyName", e.target.value)} />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500">브랜드명</label>
        <input className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={form.brandName} onChange={(e) => update("brandName", e.target.value)} />
        {dup && <p className="text-rose-600 text-xs font-bold mt-1">⚠️ [{dup}]은 이미 등록된 브랜드입니다. 중복 컨택에 유의하세요!</p>}
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500">연락처</label>
        <input className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={form.contact} onChange={(e) => update("contact", e.target.value)} />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-500">담당 오거나이저</label>
        <input
          className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          value={form.manager}
          onChange={(e) => update("manager", e.target.value)}
          placeholder="예: 한수아"
          list="family-organizer-list"
        />
        <datalist id="family-organizer-list">
          {organizers.map((o) => <option key={o.id} value={o.name} />)}
        </datalist>
      </div>
      <div className="md:col-span-2">
        <label className="text-xs font-semibold text-slate-500">설명 및 비고</label>
        <textarea className="w-full mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={2}
          value={form.note} onChange={(e) => update("note", e.target.value)} />
      </div>
      <div className="md:col-span-3 flex justify-end">
        <button onClick={submit} className="flex items-center gap-1.5 bg-slate-900 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-slate-700">
          <Plus size={16} /> 패밀리 파트너 추가
        </button>
      </div>
    </div>
  );
}

function Tab2() {
  const { familyPartners, addFamily, updateFamily, deleteFamily } = useApp();
  return (
    <SectionCard title="패밀리 파트너 관리 (27기~30기)" icon={<Building2 size={17} className="text-rose-600" />}>
      <FamilyForm onSubmit={addFamily} />
      <div className="overflow-x-auto mt-4 rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="text-left px-3 py-2">기수</th>
              <th className="text-left px-3 py-2">뉴스레터</th>
              <th className="text-left px-3 py-2">협업횟수</th>
              <th className="text-left px-3 py-2">현황</th>
              <th className="text-left px-3 py-2">기업명</th>
              <th className="text-left px-3 py-2">브랜드명</th>
              <th className="text-left px-3 py-2">연락처</th>
              <th className="text-left px-3 py-2">담당자</th>
              <th className="text-left px-3 py-2">비고</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {familyPartners.length === 0 && <EmptyRow colSpan={10} text="등록된 패밀리 파트너가 없습니다." />}
            {familyPartners.map((r) => (
              <tr key={r.id} className={`border-t border-slate-100 ${r.status === "거절" ? "bg-rose-50/60" : r.status === "체결완료" ? "bg-emerald-50/60" : r.status === "블랙리스트" ? "bg-slate-200/70" : ""}`}>
                <td className="px-3 py-2 min-w-[90px]">
                  <input list="family-gen-list" className="w-full bg-transparent outline-none text-xs" value={r.generation}
                    placeholder="예: 29, 30기" onChange={(e) => updateFamily(r.id, { generation: e.target.value })} />
                </td>
                <td className="px-3 py-2 min-w-[90px]">
                  <input className="w-full bg-transparent outline-none text-xs" value={r.newsletter || ""}
                    onChange={(e) => updateFamily(r.id, { newsletter: e.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <select className="text-xs rounded-md border border-slate-200 px-1.5 py-1" value={r.collabCount}
                    onChange={(e) => updateFamily(r.id, { collabCount: e.target.value })}>
                    {COLLAB_COUNTS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2"><StatusSelect options={FAMILY_STATUS_OPTIONS} value={r.status} onChange={(v) => updateFamily(r.id, { status: v })} /></td>
                <td className="px-3 py-2 min-w-[130px]"><input className="w-full bg-transparent outline-none" value={r.companyName} onChange={(e) => updateFamily(r.id, { companyName: e.target.value })} /></td>
                <td className="px-3 py-2 min-w-[110px]"><input className="w-full bg-transparent outline-none font-medium" value={r.brandName} onChange={(e) => updateFamily(r.id, { brandName: e.target.value })} /></td>
                <td className="px-3 py-2 min-w-[130px]"><input className="w-full bg-transparent outline-none text-xs" value={r.contact} onChange={(e) => updateFamily(r.id, { contact: e.target.value })} /></td>
                <td className="px-3 py-2 min-w-[90px]">
                  <input
                    className="w-full bg-transparent outline-none text-xs font-semibold text-slate-700"
                    value={r.manager || ""}
                    onChange={(e) => updateFamily(r.id, { manager: e.target.value })}
                    placeholder="예: 한수아"
                  />
                </td>
                <td className="px-3 py-2 min-w-[150px]"><input className="w-full bg-transparent outline-none text-xs" value={r.note} onChange={(e) => updateFamily(r.id, { note: e.target.value })} /></td>
                <td className="px-3 py-2"><IconBtn danger title="삭제" onClick={() => deleteFamily(r.id)}><Trash2 size={14} /></IconBtn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

/* =========================================================================
   TAB 3: 체결 및 재정 관리
========================================================================= */

const GRADE_ROW_BG = {
  LITE: "bg-white",
  STANDARD: "bg-blue-50/50",
  PREMIUM: "bg-rose-50/50",
};

function CurrencyInput({ value, onChange }) {
  return (
    <div className="flex items-center border border-slate-200 rounded-md bg-white px-1.5 focus-within:border-slate-400 min-w-[92px]">
      <span className="text-slate-400 text-[11px] mr-0.5 shrink-0">₩</span>
      <input
        type="number"
        className="w-full bg-transparent outline-none text-xs py-1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function MiniToggle({ value, onToggle }) {
  const done = value === "완료";
  return (
    <button
      onClick={onToggle}
      className={`w-full text-[10px] font-bold px-1 py-1 rounded-md border transition-colors ${
        done ? "bg-emerald-500 text-white border-emerald-500" : "bg-slate-100 text-slate-500 border-slate-300"
      }`}
    >
      {done ? "완료" : "대기"}
    </button>
  );
}

function DealTableRow({ deal, onUpdate, onDelete }) {
  function patch(p) { onUpdate(deal.id, p); }
  function patchSize(axis, val) { onUpdate(deal.id, { inKindSize: { ...deal.inKindSize, [axis]: val } }); }

  return (
    <tr className={`border-b border-slate-100 ${GRADE_ROW_BG[deal.grade] || "bg-white"} hover:bg-amber-50/40 transition-colors`}>
      <td className="px-1.5 py-1">
        <select
          className={`w-full text-[11px] font-bold rounded-md border px-1 py-1 cursor-pointer ${GRADE_CONFIG[deal.grade].accent}`}
          value={deal.grade}
          onChange={(e) => patch({ grade: e.target.value })}
        >
          {Object.keys(GRADE_CONFIG).map((g) => <option key={g} value={g}>{GRADE_CONFIG[g].label}</option>)}
        </select>
      </td>
      <td className="px-1.5 py-1 text-center">
        <input type="checkbox" className="accent-orange-500 w-4 h-4 cursor-pointer" checked={deal.earlyBird} onChange={(e) => patch({ earlyBird: e.target.checked })} />
      </td>
      <td className="px-1.5 py-1 text-center">
        <input type="checkbox" className="accent-violet-500 w-4 h-4 cursor-pointer" checked={deal.isFamilyPartner} onChange={(e) => patch({ isFamilyPartner: e.target.checked })} />
      </td>
      <td className="px-1.5 py-1">
        <input className="w-full bg-transparent outline-none font-semibold text-xs min-w-[100px]" value={deal.brandName} placeholder="브랜드명" onChange={(e) => patch({ brandName: e.target.value })} />
      </td>
      <td className="px-1.5 py-1">
        <input className="w-full bg-transparent outline-none text-xs min-w-[70px]" value={deal.managerName} placeholder="담당자" onChange={(e) => patch({ managerName: e.target.value })} />
      </td>
      <td className="px-1.5 py-1">
        <input type="date" className="bg-transparent outline-none text-[11px] w-[112px]" value={deal.confirmDate} onChange={(e) => patch({ confirmDate: e.target.value })} />
      </td>
      <td className="px-1.5 py-1">
        <CurrencyInput value={deal.actualCash} onChange={(v) => patch({ actualCash: v })} />
      </td>
      <td className="px-1.5 py-1 w-16">
        <MiniToggle value={deal.paymentStatus} onToggle={() => patch({ paymentStatus: deal.paymentStatus === "대기" ? "완료" : "대기" })} />
      </td>
      <td className="px-1.5 py-1">
        <CurrencyInput value={deal.actualInKind} onChange={(v) => patch({ actualInKind: v })} />
      </td>
      <td className="px-1.5 py-1">
        <input className="w-full bg-transparent outline-none text-xs min-w-[80px]" value={deal.inKindType} placeholder="현물 종류" onChange={(e) => patch({ inKindType: e.target.value })} />
      </td>
      <td className="px-1.5 py-1">
        <div className="flex items-center gap-0.5 text-[11px] whitespace-nowrap">
          <input type="number" className="w-9 border border-slate-200 rounded px-1 py-1 text-center" value={deal.inKindSize.w} onChange={(e) => patchSize("w", e.target.value)} />
          <span className="text-slate-300">x</span>
          <input type="number" className="w-9 border border-slate-200 rounded px-1 py-1 text-center" value={deal.inKindSize.h} onChange={(e) => patchSize("h", e.target.value)} />
          <span className="text-slate-300">x</span>
          <input type="number" className="w-9 border border-slate-200 rounded px-1 py-1 text-center" value={deal.inKindSize.d} onChange={(e) => patchSize("d", e.target.value)} />
        </div>
      </td>
      <td className="px-1.5 py-1 w-16">
        <MiniToggle value={deal.deliveryStatus} onToggle={() => patch({ deliveryStatus: deal.deliveryStatus === "대기" ? "완료" : "대기" })} />
      </td>
      <td className="px-1.5 py-1 text-center">
        <IconBtn danger title="삭제" onClick={() => onDelete(deal.id)}><Trash2 size={13} /></IconBtn>
      </td>
    </tr>
  );
}

function DealsTable({ deals, onUpdate, onDelete }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-900 text-white">
            <th className="px-2 py-2 text-left font-bold whitespace-nowrap">등급</th>
            <th className="px-2 py-2 text-center font-bold whitespace-nowrap">얼리버드</th>
            <th className="px-2 py-2 text-center font-bold whitespace-nowrap">패밀리</th>
            <th className="px-2 py-2 text-left font-bold whitespace-nowrap">파트너(브랜드명)</th>
            <th className="px-2 py-2 text-left font-bold whitespace-nowrap">담당자</th>
            <th className="px-2 py-2 text-left font-bold whitespace-nowrap">확인서 확정일</th>
            <th className="px-2 py-2 text-left font-bold whitespace-nowrap">실제 현금액</th>
            <th className="px-2 py-2 text-center font-bold whitespace-nowrap">입금</th>
            <th className="px-2 py-2 text-left font-bold whitespace-nowrap">실제 현물액</th>
            <th className="px-2 py-2 text-left font-bold whitespace-nowrap">현물 종류</th>
            <th className="px-2 py-2 text-left font-bold whitespace-nowrap">사이즈 W×H×D(cm)</th>
            <th className="px-2 py-2 text-center font-bold whitespace-nowrap">배송</th>
            <th className="px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {deals.length === 0 && (
            <tr><td colSpan={13} className="text-center text-slate-400 text-sm py-10">등록된 체결 기업이 없습니다.</td></tr>
          )}
          {deals.map((d) => (
            <DealTableRow key={d.id} deal={d} onUpdate={onUpdate} onDelete={onDelete} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProgressStatCard({ label, gradient, actual, goal }) {
  const pct = goal > 0 ? Math.min(100, Math.round((actual / goal) * 100)) : 0;
  return (
    <div className="rounded-xl border border-slate-200 p-4 bg-white">
      <p className="text-xs font-bold text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-black text-slate-900 mb-2">{pct}%</p>
      <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${gradient} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[11px] text-slate-400 mt-2">
        {won(actual)} / {won(goal)}
      </p>
    </div>
  );
}

function FinanceDashboard({ deals, goalCash, setGoalCash, goalInKind, setGoalInKind }) {
  const totalCash = deals.reduce((sum, d) => sum + (Number(d.actualCash) || 0), 0);
  const totalInKind = deals.reduce((sum, d) => sum + (Number(d.actualInKind) || 0), 0);
  const totalGoal = (Number(goalCash) || 0) + (Number(goalInKind) || 0);
  const totalActual = totalCash + totalInKind;

  return (
    <SectionCard title="재정 대시보드" icon={<Wallet size={17} className="text-rose-600" />}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div>
          <label className="text-xs font-semibold text-slate-500">대외협력팀 이번 기수 총 목표 현금액 (원)</label>
          <input
            type="number"
            className="block mt-1 border border-slate-300 rounded-lg px-3 py-3 text-lg w-full font-black"
            value={goalCash}
            onChange={(e) => setGoalCash(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500">대외협력팀 이번 기수 총 목표 현물액 (원)</label>
          <input
            type="number"
            className="block mt-1 border border-slate-300 rounded-lg px-3 py-3 text-lg w-full font-black"
            value={goalInKind}
            onChange={(e) => setGoalInKind(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ProgressStatCard label="현금 달성률" gradient="bg-gradient-to-r from-emerald-400 to-emerald-600" actual={totalCash} goal={Number(goalCash) || 0} />
        <ProgressStatCard label="현물 달성률" gradient="bg-gradient-to-r from-sky-400 to-sky-600" actual={totalInKind} goal={Number(goalInKind) || 0} />
        <ProgressStatCard label="통합 재정 달성률" gradient="bg-gradient-to-r from-rose-500 to-slate-900" actual={totalActual} goal={totalGoal} />
      </div>
      <p className="text-xs text-slate-400 mt-3 flex items-center gap-1">
        <TrendingUp size={13} /> 등록된 모든 체결 기업의 실제 유치액 합계를 실시간으로 반영합니다.
      </p>
    </SectionCard>
  );
}

function Tab3() {
  const {
    companies, familyPartners, deals, addDeal, updateDeal, deleteDeal,
    financeGoalCash, setFinanceGoalCash, financeGoalInKind, setFinanceGoalInKind,
  } = useApp();

  const pendingClosed = useMemo(() => {
    const fromCompanies = companies
      .filter((c) => c.status === "체결완료")
      .map((c) => ({ id: c.id, brandName: c.brandName, companyName: c.companyName }));
    const fromFamily = familyPartners
      .filter((f) => f.status === "체결완료")
      .map((f) => ({ id: f.id, brandName: f.brandName, companyName: f.companyName }));
    const already = new Set(deals.map((d) => d.sourceCompanyId).filter(Boolean));
    return [...fromCompanies, ...fromFamily].filter((c) => !already.has(c.id));
  }, [companies, familyPartners, deals]);

  return (
    <div className="space-y-4">
      <FinanceDashboard
        deals={deals}
        goalCash={financeGoalCash}
        setGoalCash={setFinanceGoalCash}
        goalInKind={financeGoalInKind}
        setGoalInKind={setFinanceGoalInKind}
      />

      {pendingClosed.length > 0 && (
        <SectionCard title="체결완료 → 재정 테이블로 가져오기" icon={<AlertTriangle size={17} className="text-amber-500" />}>
          <div className="flex flex-wrap gap-2">
            {pendingClosed.map((c) => (
              <button
                key={c.id}
                onClick={() => addDeal(emptyDeal({ brandName: c.brandName || c.companyName, sourceCompanyId: c.id }))}
                className="text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-300 hover:bg-amber-100"
              >
                + {c.brandName || c.companyName}
              </button>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="체결 기업 리스트"
        icon={<Building2 size={17} className="text-rose-600" />}
        right={
          <button
            onClick={() => addDeal(emptyDeal())}
            className="flex items-center gap-1.5 bg-slate-900 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-slate-700"
          >
            <Plus size={14} /> 수동 추가
          </button>
        }
      >
        <div>
          {deals.length > 0 && (
            <p className="text-[11px] text-slate-400 mb-2">등급별 배경색: Lite(흰색) · Standard(하늘색) · Premium(연분홍) — 등급/얼리버드/패밀리는 참고용 표시이며 목표 금액은 자동 계산되지 않습니다.</p>
          )}
          <DealsTable deals={deals} onUpdate={updateDeal} onDelete={deleteDeal} />
        </div>
      </SectionCard>
    </div>
  );
}

/* =========================================================================
   TAB 4 · 5: 자료 수합 / 이행 현황  (O / X / 불필요 3상태 체크리스트)
========================================================================= */

const STATUS_STYLE = {
  "O": "bg-emerald-500 text-white border-emerald-500",
  "X": "bg-rose-50 text-rose-500 border-rose-200",
  "불필요": "bg-slate-100 text-slate-400 border-slate-200",
};

const CHECKLIST_META = {
  collection: {
    title: "자료 수합 현황",
    groups: COLLECTION_GROUPS,
    hint: "파트너사에서 받아야 하는 자료 13개 항목의 수합 상태입니다. Lite는 7개, Standard는 10개(Lite + 홍보영상·숏폼 기획안·부스 기획안), Premium은 13개 전체가 기본 수합 대상이며, 해당하지 않는 항목은 처음부터 '불필요'로 표시됩니다. 칸을 누를 때마다 X → 불필요 → O 순서로 바뀌고, 필요하면 등급과 관계없이 직접 바꿀 수 있습니다.",
    detailHint: "항목별 메모에 링크·전달 일자 등을 아카이빙하세요.",
  },
  fulfillment: {
    title: "이행 현황",
    groups: FULFILLMENT_GROUPS,
    hint: "TEDxSNU 파트너십 혜택표 기준으로 약속한 혜택의 이행 상태입니다. 칸을 누를 때마다 X → 불필요 → O 순서로 바뀝니다. 얼리버드·패밀리 혜택은 해당 체크 시 자동으로 활성화됩니다.",
    detailHint: "이행 일자, 게재 링크 등을 메모로 남겨두세요.",
  },
};

function nextStatus(cur) {
  // X → 불필요 → O → X
  if (cur === "X") return "불필요";
  if (cur === "불필요") return "O";
  return "X";
}

function StatusCell({ value, onChange, title }) {
  return (
    <button
      title={title}
      onClick={() => onChange(nextStatus(value))}
      className={`min-w-[44px] rounded-md border px-1.5 py-0.5 text-[10px] font-bold transition-colors ${STATUS_STYLE[value]}`}
    >
      {value}
    </button>
  );
}

function StatusSegment({ value, onChange }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-slate-200">
      {STATUS_CHOICES.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`px-3 py-1 text-xs font-bold transition-colors ${
            value === s ? STATUS_STYLE[s] : "bg-white text-slate-400 hover:bg-slate-50"
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function DealBadges({ deal }) {
  const cfg = GRADE_CONFIG[deal.grade] || GRADE_CONFIG.LITE;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${cfg.accent}`}>{cfg.label}</span>
      {deal.earlyBird && <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-600">얼리버드</span>}
      {deal.isFamilyPartner && <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-600">패밀리</span>}
    </span>
  );
}

function ChecklistDetail({ kind, deal, onClose }) {
  const meta = CHECKLIST_META[kind];
  const { collection, fulfillment, setChecklistStatus, setChecklistNote, updateDeal } = useApp();
  const store = kind === "collection" ? collection : fulfillment;
  const { done, total } = progressOf(store, deal, meta.groups);

  function patchVip(field, val) {
    updateDeal(deal.id, { vipInfo: { ...deal.vipInfo, [field]: val } });
  }
  const size = `${deal.inKindSize?.w || "-"} x ${deal.inKindSize?.h || "-"} x ${deal.inKindSize?.d || "-"} cm`;

  return (
    <SectionCard
      title={`${meta.title} 상세 · ${deal.brandName || "(무제)"}`}
      icon={<StickyNote size={17} className="text-rose-600" />}
      right={<IconBtn title="닫기" onClick={onClose}><X size={14} /></IconBtn>}
    >
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-xs md:grid-cols-4">
        <div><span className="text-slate-400">브랜드</span><div className="font-bold">{deal.brandName || "-"}</div></div>
        <div><span className="text-slate-400">등급 / 구분</span><div className="mt-0.5"><DealBadges deal={deal} /></div></div>
        <div><span className="text-slate-400">현물 종류 · 사이즈</span><div className="font-bold">{deal.inKindType || "-"} · {size}</div></div>
        <div><span className="text-slate-400">진행률 (불필요 제외)</span><div className="font-bold">{done} / {total}</div></div>
      </div>
      <p className="mb-3 text-[11px] text-slate-400">{meta.detailHint}</p>

      <div className="space-y-5">
        {meta.groups.map((g) => (
          <div key={g.key}>
            <div className="mb-1.5 text-xs font-bold text-slate-400">{g.label}</div>
            <div className="space-y-2">
              {g.items.map((item) => {
                const status = getStatus(store, deal, item);
                return (
                  <div key={item.name} className={`rounded-lg border p-3 ${status === "불필요" ? "border-slate-100 bg-slate-50/60" : "border-slate-200"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`text-sm font-semibold ${status === "불필요" ? "text-slate-400" : "text-slate-700"}`}>{item.name}</span>
                      <StatusSegment value={status} onChange={(v) => setChecklistStatus(kind, deal.id, item.name, v)} />
                    </div>

                    {kind === "collection" && item.name === "VIP 정보" && (
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <input placeholder="방문 VIP 브랜드명" className="rounded-md border border-slate-200 px-2 py-1" value={deal.vipInfo?.visitBrand || ""} onChange={(e) => patchVip("visitBrand", e.target.value)} />
                        <input placeholder="등급명" className="rounded-md border border-slate-200 px-2 py-1" value={deal.vipInfo?.gradeName || ""} onChange={(e) => patchVip("gradeName", e.target.value)} />
                        <input placeholder="본인 이름" className="rounded-md border border-slate-200 px-2 py-1" value={deal.vipInfo?.personName || ""} onChange={(e) => patchVip("personName", e.target.value)} />
                        <input placeholder="연락처" className="rounded-md border border-slate-200 px-2 py-1" value={deal.vipInfo?.contact || ""} onChange={(e) => patchVip("contact", e.target.value)} />
                      </div>
                    )}
                    {kind === "collection" && ["현물 이미지", "상품 소개 문구", "현물 사이즈"].includes(item.name) && (
                      <p className="mt-1 text-[11px] text-slate-400">체결 및 재정 관리에 입력된 현물 정보: {deal.inKindType || "-"} · {size}</p>
                    )}

                    <div className="mt-2 flex items-start gap-1.5">
                      <StickyNote size={13} className="mt-1.5 shrink-0 text-slate-300" />
                      <textarea
                        className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs"
                        rows={1}
                        placeholder="메모 / 아카이빙 내용을 입력하세요"
                        value={getNote(store, deal, item)}
                        onChange={(e) => setChecklistNote(kind, deal.id, item.name, e.target.value)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function ChecklistTab({ kind }) {
  const meta = CHECKLIST_META[kind];
  const { deals, collection, fulfillment, setChecklistStatus } = useApp();
  const store = kind === "collection" ? collection : fulfillment;
  const [selectedId, setSelectedId] = useState(null);
  const selected = deals.find((d) => d.id === selectedId);

  const groupColors = ["bg-slate-800", "bg-slate-700", "bg-slate-600", "bg-slate-500"];

  return (
    <div className="space-y-4">
      <SectionCard title={`${meta.title} 종합표`} icon={<ClipboardCheck size={17} className="text-rose-600" />}>
        <p className="mb-3 text-xs text-slate-400">{meta.hint}</p>
        {deals.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">체결 및 재정 관리 탭에서 체결 기업을 먼저 등록해주세요.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="text-white">
                  <th rowSpan={2} className="sticky left-0 z-10 bg-slate-900 px-3 py-2 text-left font-bold">브랜드</th>
                  <th rowSpan={2} className="bg-slate-900 px-2 py-2 text-left font-bold whitespace-nowrap">등급</th>
                  {meta.groups.map((g, gi) => (
                    <th key={g.key} colSpan={g.items.length} className={`${groupColors[gi % groupColors.length]} border-l border-slate-900 px-2 py-1.5 text-center font-bold`}>
                      {g.label}
                    </th>
                  ))}
                  <th rowSpan={2} className="bg-slate-900 px-2 py-2 text-center font-bold whitespace-nowrap">진행률</th>
                </tr>
                <tr className="bg-slate-100 text-slate-600">
                  {meta.groups.flatMap((g) =>
                    g.items.map((item) => (
                      <th key={item.name} title={item.name} className="min-w-[78px] max-w-[96px] border-l border-slate-200 px-1.5 py-1.5 text-center align-bottom text-[10px] font-semibold leading-tight">
                        {item.short || item.name}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {deals.map((d) => {
                  const { done, total } = progressOf(store, d, meta.groups);
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  return (
                    <tr key={d.id} className={`border-t border-slate-100 hover:bg-amber-50/40 ${selectedId === d.id ? "bg-amber-50/60" : ""}`}>
                      <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1.5 font-semibold">
                        <button className="text-rose-600 hover:underline" onClick={() => setSelectedId(d.id)}>
                          {d.brandName || "(무제)"}
                        </button>
                      </td>
                      <td className="px-2 py-1.5"><DealBadges deal={d} /></td>
                      {meta.groups.flatMap((g) =>
                        g.items.map((item) => (
                          <td key={item.name} className="border-l border-slate-100 px-1 py-1.5 text-center">
                            <StatusCell
                              value={getStatus(store, d, item)}
                              title={item.name}
                              onChange={(v) => setChecklistStatus(kind, d.id, item.name, v)}
                            />
                          </td>
                        ))
                      )}
                      <td className="whitespace-nowrap px-2 py-1.5 text-center">
                        <div className="mx-auto h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="mt-0.5 text-[10px] font-bold text-slate-500">{done}/{total}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {selected && <ChecklistDetail kind={kind} deal={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function Tab4() {
  return <ChecklistTab kind="collection" />;
}

function Tab5() {
  return <ChecklistTab kind="fulfillment" />;
}

/* =========================================================================
   구글 시트 연동 가이드 / 상태
========================================================================= */

function GoogleSheetPanel() {
  const { sheetConfig, updateWebhookUrl, syncStatus, syncNow, loadNow, sheetInfo } = useApp();
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-slate-200 rounded-xl bg-white">
      <button className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-semibold text-slate-600" onClick={() => setOpen((o) => !o)}>
        <span className="flex items-center gap-2">
          <Info size={15} className="text-rose-500" /> 구글 시트 실시간 연동 설정 가이드
        </span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {sheetInfo && (
        <div className="px-4 pb-2 space-y-0.5">
          <p className={`text-[11px] font-semibold ${sheetInfo.level === "warn" ? "text-rose-500" : "text-emerald-600"}`}>
            {sheetInfo.level === "warn" ? "⚠️ " : "✓ "}{sheetInfo.text}
          </p>
          {(sheetInfo.lines || []).map((n, i) => (
            <p key={i} className="text-[11px] text-rose-500">· {n.text}</p>
          ))}
          {sheetInfo.tabs && sheetInfo.tabs.length > 0 && (
            <p className="text-[11px] text-slate-400">
              {sheetInfo.tabs.map((t) => `${t.name} ${t.count}`).join(" · ")}
            </p>
          )}
        </div>
      )}
      {open && (
        <div className="px-4 pb-4 text-xs text-slate-500 space-y-2 border-t border-slate-100 pt-3">
          <ol className="list-decimal list-inside space-y-1">
            <li>구글 스프레드시트에서 <b>확장 프로그램 → Apps Script</b>에 최신 스크립트(v3)를 붙여넣고 <b>새 버전</b>으로 웹앱 배포한 뒤, 웹앱 URL을 아래 입력창에 붙여넣습니다.</li>
            <li><b>팀원 탭</b>(명우·가연·세진·윤서·채현·재민)과 <b>패밀리</b> 탭은 시트의 각 행과 1:1로 연결됩니다. 앱에서 고친 칸만 해당 행에 저장되고, 시트에서 직접 고친 내용은 45초 안에(또는 새로고침·'시트에서 불러오기' 때) 앱에 반영됩니다.</li>
            <li><b>전체 오거나이저</b> 탭: 팀원 탭에 이미 있는 기업(복사본)은 건너뛰고, 거기에만 있는 기업은 불러옵니다. [타 부서 제안]으로 등록한 기업은 이 탭 맨 아래 빈 행에 제안자 이름과 함께 기록됩니다.</li>
            <li><b>발송 완료·회신·체결 의사·체결 완료·거절</b> 탭은 수식 탭이라 앱이 읽지도 쓰지도 않습니다. 팀원 탭의 G열 메모 등 A~F열 밖의 칸도 건드리지 않습니다.</li>
            <li>앱에서 기업을 삭제하면 시트에서는 그 행의 A~F열 값만 비워집니다(행은 삭제되지 않음). 같은 행을 다른 사람이 먼저 고쳤다면 덮어쓰지 않고 시트 내용을 따릅니다.</li>
            <li>체결·재정, 자료 수합, 이행 현황, 기업별 앱 전용 정보(기업 구분 외 어필 포인트 등)는 <b>_RawData</b>(숨김 시트)에 저장되고, 사람이 보기 좋은 표는 '체결및재정·자료수합·이행현황·설정' 탭에도 기록됩니다.</li>
          </ol>
          <div className="flex flex-col md:flex-row gap-2 pt-2">
            <input
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2"
              placeholder="Google Apps Script Webhook URL"
              value={sheetConfig.webhookUrl}
              onChange={(e) => updateWebhookUrl(e.target.value)}
            />
            <button onClick={loadNow} className="flex items-center gap-1.5 justify-center bg-white text-slate-700 border border-slate-300 font-semibold px-4 py-2 rounded-lg hover:bg-slate-50">
              <Download size={14} /> 시트에서 불러오기
            </button>
            <button onClick={syncNow} className="flex items-center gap-1.5 justify-center bg-slate-900 text-white font-semibold px-4 py-2 rounded-lg hover:bg-slate-700">
              <RefreshCw size={14} /> 지금 동기화
            </button>
          </div>
          <p className="text-[11px] text-slate-400 flex items-center gap-1">
            <ExternalLink size={11} /> 현재 상태: {syncStatus === "connected" ? "연동됨" : syncStatus === "syncing" ? "동기화 중..." : syncStatus === "error" ? "연동 오류 (로컬 백업 유지)" : "미연결 (로컬 저장만 사용)"}
          </p>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   Header
========================================================================= */

function Header() {
  const { syncStatus, exportJson, importJson, exportCsv } = useApp();
  const fileRef = useRef(null);

  return (
    <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black text-sm">CR</div>
          <div>
            <h1 className="font-black text-slate-900 leading-tight">대외협력 통합 데이터베이스</h1>
            <p className="text-[11px] text-slate-400">TEDx Organizing Committee · Corporate Relations Dashboard</p>
          </div>
          <span
            className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full border ${
              syncStatus === "connected"
                ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                : syncStatus === "syncing"
                ? "bg-amber-50 text-amber-600 border-amber-200"
                : "bg-rose-50 text-rose-500 border-rose-200"
            }`}
            title="Google Sheets 연동 상태"
          >
            {syncStatus === "connected" ? <Cloud size={12} /> : <CloudOff size={12} />}
            {syncStatus === "connected" ? "시트 연동됨" : syncStatus === "syncing" ? "동기화 중" : "미연결"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={exportJson} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50">
            <Download size={14} /> JSON 내보내기
          </button>
          <button onClick={() => fileRef.current.click()} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50">
            <Upload size={14} /> JSON 불러오기
          </button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={(e) => {
            const f = e.target.files[0];
            if (f) importJson(f);
            e.target.value = "";
          }} />
          <button onClick={exportCsv} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-700">
            <FileSpreadsheet size={14} /> 엑셀(CSV) 다운로드
          </button>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 pb-3">
        <GoogleSheetPanel />
      </div>
    </div>
  );
}

/* =========================================================================
   메인 App
========================================================================= */

const TABS = [
  { key: "tab1", label: "부서별/팀원별 서칭 관리", icon: <Building2 size={16} /> },
  { key: "tab2", label: "패밀리 파트너 관리", icon: <Users size={16} /> },
  { key: "tab3", label: "체결 및 재정 관리", icon: <Wallet size={16} /> },
  { key: "tab4", label: "자료 수합", icon: <ClipboardCheck size={16} /> },
  { key: "tab5", label: "이행 현황", icon: <CheckCircle2 size={16} /> },
];

/* 앱 전용 데이터 스냅샷(_RawData) — 시트에 열이 없는 정보와 체결/재정/자료 수합 등 */
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16) + ":" + s.length;
}

function isUnlinkable(c, organizers) {
  if (c.sheet) return false;
  const o = orgOfCompany(c, organizers);
  if (o) return !o.sheetTab;
  return !(c.source && c.source.type === "dept");
}

function buildSnapshot(st) {
  return {
    v: SYNC_V,
    deals: st.deals,
    collection: st.collection,
    fulfillment: st.fulfillment,
    legacySubmissions: st.legacySubmissions || null,
    financeGoalCash: st.financeGoalCash,
    financeGoalInKind: st.financeGoalInKind,
    organizers: st.organizers,
    extras: buildExtras(st.companies, st.familyPartners),
    localOnly: {
      companies: st.companies.filter((c) => isUnlinkable(c, st.organizers)),
      familyPartners: [],
    },
  };
}

// 사람이 읽는 보고용 탭(체결및재정·자료수합·이행현황·설정)에 쓸 표
function buildViews(st) {
  const deals = {
    headers: ["ID", "브랜드명", "담당자", "확인서확정일", "등급", "얼리버드", "얼리버드마감일", "패밀리파트너", "패밀리협업횟수", "실제유치현금액", "실제유치현물액", "현물종류", "현물가로(cm)", "현물세로(cm)", "현물높이(cm)", "입금여부", "배송여부", "VIP_방문브랜드", "VIP_등급명", "VIP_본인이름", "VIP_연락처"],
    rows: st.deals.map((d) => [
      d.id || "", d.brandName || "", d.managerName || "", d.confirmDate || "", (GRADE_CONFIG[d.grade] || {}).label || d.grade || "",
      d.earlyBird ? "Y" : "N", d.earlyBirdDeadline || "", d.isFamilyPartner ? "Y" : "N", d.familyCollabCount || "",
      Number(d.actualCash) || 0, Number(d.actualInKind) || 0, d.inKindType || "",
      (d.inKindSize && d.inKindSize.w) || "", (d.inKindSize && d.inKindSize.h) || "", (d.inKindSize && d.inKindSize.d) || "",
      d.paymentStatus || "", d.deliveryStatus || "",
      (d.vipInfo && d.vipInfo.visitBrand) || "", (d.vipInfo && d.vipInfo.gradeName) || "", (d.vipInfo && d.vipInfo.personName) || "", (d.vipInfo && d.vipInfo.contact) || "",
    ]),
  };
  const list = (kind, groups, store) => {
    const rows = [];
    st.deals.forEach((d) =>
      groups.forEach((g) =>
        g.items.forEach((item) =>
          rows.push([d.id || "", d.brandName || "", (GRADE_CONFIG[d.grade] || {}).label || d.grade || "", g.label, item.name, getStatus(store, d, item), getNote(store, d, item)])
        )
      )
    );
    return { headers: ["딜ID", "브랜드명", "등급", "구분", "항목명", "상태(O/X/불필요)", "메모"], rows };
  };
  return {
    deals,
    collection: list("collection", COLLECTION_GROUPS, st.collection),
    fulfillment: list("fulfillment", FULFILLMENT_GROUPS, st.fulfillment),
    settings: {
      headers: ["항목", "값"],
      rows: [["총 목표 현금액", Number(st.financeGoalCash) || 0], ["총 목표 현물액", Number(st.financeGoalInKind) || 0], ["마지막 동기화 시각", new Date().toISOString()]],
    },
  };
}

async function sheetGet(url) {
  const res = await fetch(url, { method: "GET" });
  const data = await res.json();
  if (!data || data.ok === false) throw new Error((data && data.error) || "load failed");
  if (!Array.isArray(data.tabs)) throw new Error("OLD_SCRIPT");
  return data;
}

async function sheetPost(url, payload) {
  const body = JSON.stringify(payload);
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body });
    return await res.json();
  } catch (e) {
    // 브라우저가 응답을 읽지 못하게 막는 환경: 전송만 하고 결과는 바로 이어지는 읽기에서 확인
    await fetch(url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body });
    return { ok: true, unverified: true, results: [] };
  }
}

export default function App() {
  const persisted0 = useMemo(() => migrateState(loadFromLocalStorage()), []);

  // v3 이전 버전이 저장해 둔 기업/패밀리 목록은 시트와 연결된 적이 없어서 그대로 쓰면 시트 내용과 중복됩니다.
  // 지우지 않고 별도 백업 키에 남겨 두고, 앱은 시트에서 새로 불러옵니다.
  const persisted = useMemo(() => {
    const p = persisted0;
    if (p && !p._sync && ((p.companies && p.companies.length) || (p.familyPartners && p.familyPartners.length))) {
      try { localStorage.setItem(LS_KEY + "_pre_v3_backup", JSON.stringify(p)); } catch (e) { /* ignore */ }
      return { ...p, companies: [], familyPartners: [], organizers: [] };
    }
    return p;
  }, [persisted0]);

  const [companies, setCompanies] = useState((persisted?.companies || []).map((c) => ({ sheet: null, ...c })));
  const [familyPartners, setFamilyPartners] = useState((persisted?.familyPartners || []).map((f) => ({ sheet: null, newsletter: "", ...f })));
  const [deals, setDeals] = useState(persisted?.deals || []);
  const [collection, setCollection] = useState(persisted?.collection || {});
  const [fulfillment, setFulfillment] = useState(persisted?.fulfillment || {});
  const [legacySubmissions, setLegacySubmissions] = useState(persisted?.legacySubmissions || null);
  const [organizers, setOrganizers] = useState(
    persisted?.organizers && persisted.organizers.length > 0
      ? persisted.organizers
      : DEFAULT_ORGANIZERS.map((name) => ({ id: `org-${name}`, name, sheetTab: name }))
  );
  const [financeGoalCash, setFinanceGoalCash] = useState(persisted?.financeGoalCash ?? 3000000);
  const [financeGoalInKind, setFinanceGoalInKind] = useState(persisted?.financeGoalInKind ?? 2000000);
  const [sheetConfig, setSheetConfig] = useState(() => normalizeSheetConfig(persisted?.sheetConfig));
  const [syncStatus, setSyncStatus] = useState("disconnected");
  const [activeTab, setActiveTab] = useState("tab1");
  const [hydrated, setHydrated] = useState(false);
  const [sheetInfo, setSheetInfo] = useState(null); // { level, text, lines: [{level,text}], tabs: [{name,kind,count}], unlinked }

  // 비동기 동기화 코드가 항상 최신 상태를 읽을 수 있게 보관
  const stateRef = useRef(null);
  stateRef.current = { companies, familyPartners, organizers, deals, collection, fulfillment, legacySubmissions, financeGoalCash, financeGoalInKind };
  const urlRef = useRef(sheetConfig.webhookUrl);
  urlRef.current = sheetConfig.webhookUrl;

  // 시트와의 동기화 기록(이 브라우저가 마지막으로 본 시트 내용)
  const baseRef = useRef((persisted && persisted._sync && persisted._sync.base) || {});
  const extrasRef = useRef((persisted && persisted._sync && persisted._sync.extras) || { companies: {}, family: {} });
  const snapHashRef = useRef((persisted && persisted._sync && persisted._sync.snapHash) || null);
  const firstLoadDone = useRef(false);
  const busy = useRef(false);
  const again = useRef(false);
  const syncTimer = useRef(null);

  const applyState = (patch) => {
    const cur = stateRef.current;
    stateRef.current = { ...cur, ...patch };
    if (patch.companies) setCompanies(patch.companies);
    if (patch.familyPartners) setFamilyPartners(patch.familyPartners);
    if (patch.organizers) setOrganizers(patch.organizers);
    if (patch.deals) setDeals(patch.deals);
    if (patch.collection) setCollection(patch.collection);
    if (patch.fulfillment) setFulfillment(patch.fulfillment);
    if ("legacySubmissions" in patch) setLegacySubmissions(patch.legacySubmissions);
    if (typeof patch.financeGoalCash === "number") setFinanceGoalCash(patch.financeGoalCash);
    if (typeof patch.financeGoalInKind === "number") setFinanceGoalInKind(patch.financeGoalInKind);
  };

  const persistNow = () => {
    const s = stateRef.current;
    saveToLocalStorage({
      ...s,
      sheetConfig: { webhookUrl: urlRef.current },
      _sync: { base: baseRef.current, extras: extrasRef.current, snapHash: snapHashRef.current },
    });
  };

  // 이 브라우저에 아직 서버에 저장하지 못한 앱 데이터가 있는가?
  const hasUnsavedLocal = () => {
    if (!persisted) return false;
    if (!persisted._sync) return !!((persisted.deals && persisted.deals.length) || Object.keys(persisted.collection || {}).length || Object.keys(persisted.fulfillment || {}).length);
    return hashStr(JSON.stringify(buildSnapshot(stateRef.current))) !== persisted._sync.snapHash;
  };

  // 서버에 저장된 앱 데이터(체결·재정·자료 수합 등)를 가져와 적용
  function adoptSnapshot(snap) {
    if (!snap || typeof snap !== "object") return;
    const data = migrateState(snap);
    const patch = {};
    if (Array.isArray(data.deals)) patch.deals = data.deals;
    if (data.collection && typeof data.collection === "object") patch.collection = data.collection;
    if (data.fulfillment && typeof data.fulfillment === "object") patch.fulfillment = data.fulfillment;
    if ("legacySubmissions" in data) patch.legacySubmissions = data.legacySubmissions || null;
    if (typeof data.financeGoalCash === "number") patch.financeGoalCash = data.financeGoalCash;
    if (typeof data.financeGoalInKind === "number") patch.financeGoalInKind = data.financeGoalInKind;
    if (data.v === SYNC_V) {
      const cur = stateRef.current;
      if (Array.isArray(data.organizers) && data.organizers.length > 0) {
        const ids = new Set(data.organizers.map((o) => o.id));
        const referenced = new Set(cur.companies.map((c) => c.source && c.source.key));
        patch.organizers = [...data.organizers, ...cur.organizers.filter((o) => !ids.has(o.id) && referenced.has(o.id))];
      }
      if (data.extras) extrasRef.current = data.extras;
      if (data.localOnly && Array.isArray(data.localOnly.companies)) {
        const have = new Set(cur.companies.map((c) => c.id));
        patch.companies = [...cur.companies, ...data.localOnly.companies.filter((c) => !have.has(c.id)).map((c) => ({ ...c, sheet: null }))];
      }
    }
    applyState(patch);
  }

  const showInfo = (level, text, lines = [], server = null, stats = null) =>
    setSheetInfo((prev) => ({
      level, text, lines,
      tabs: server ? server.tabs.map((t) => ({ name: t.name, kind: t.kind, count: t.rows.length })) : prev && prev.tabs,
      unlinked: stats ? stats.unlinked : prev && prev.unlinked,
    }));

  // 한 번의 동기화: ① 시트 읽기 → ② 3자 병합(앱 변경·시트 변경 구분) → ③ 내가 바꾼 칸만 저장 → ④ 결과 반영
  const runCycle = useCallback(async ({ pullOnly = false } = {}) => {
    const url = urlRef.current;
    if (!url) { setSyncStatus("disconnected"); return false; }
    if (busy.current) { again.current = true; return false; }
    busy.current = true;
    setSyncStatus("syncing");
    try {
      const server = await sheetGet(url);

      if (!firstLoadDone.current) {
        // 처음 불러올 때: 저장 안 된 로컬 변경이 없을 때만 서버의 앱 데이터를 적용
        if (!hasUnsavedLocal()) adoptSnapshot(server.snapshot);
        else if (server.snapshot && server.snapshot.extras && !extrasRef.current.companies) extrasRef.current = server.snapshot.extras;
        firstLoadDone.current = true;
      }

      let r = reconcileSheet(stateRef.current, baseRef.current, server, extrasRef.current);
      const bulk = r.ops.filter((o) => o.type === "clear").length;
      if (!pullOnly && bulk >= BULK_CLEAR_CONFIRM) {
        const ok = window.confirm(`앱에서 삭제한 기업 ${bulk}건을 구글 시트에서도 지울까요?\n(취소하면 시트 내용을 그대로 두고 앱에 다시 불러옵니다)`);
        if (!ok) r = reconcileSheet(stateRef.current, baseRef.current, server, extrasRef.current, { keepDeleted: true });
      }

      baseRef.current = r.base;
      if (r.changed) applyState({ companies: r.companies, familyPartners: r.familyPartners, organizers: r.organizers });

      let ops = pullOnly ? [] : r.ops;
      const notices = [...r.notices];
      let retry = false;
      let appended = 0;
      let unverified = false;
      const snapStr = JSON.stringify(buildSnapshot(stateRef.current));
      const snapChanged = hashStr(snapStr) !== snapHashRef.current;

      if (!pullOnly && (ops.length > 0 || snapChanged)) {
        const payload = { v: SYNC_V, ops, snapshot: snapChanged ? snapStr : undefined, views: snapChanged || ops.length ? buildViews(stateRef.current) : undefined };
        const res = await sheetPost(url, payload);
        if (!res || res.ok === false) throw new Error((res && res.error) || "save failed");
        if (res.unverified) {
          unverified = true;
          retry = ops.length > 0;
        } else {
          const out = applyOpResults(ops, res.results, baseRef.current);
          baseRef.current = out.base;
          notices.push(...out.notices);
          retry = out.retry;
          appended = out.appended;
          if (Object.keys(out.refs).length > 0) {
            setCompanies((prev) => prev.map((c) => (out.refs[c.id] ? { ...c, sheet: out.refs[c.id] } : c)));
            setFamilyPartners((prev) => prev.map((f) => (out.refs[f.id] ? { ...f, sheet: out.refs[f.id] } : f)));
            stateRef.current = {
              ...stateRef.current,
              companies: stateRef.current.companies.map((c) => (out.refs[c.id] ? { ...c, sheet: out.refs[c.id] } : c)),
              familyPartners: stateRef.current.familyPartners.map((f) => (out.refs[f.id] ? { ...f, sheet: out.refs[f.id] } : f)),
            };
          }
        }
        if (snapChanged) snapHashRef.current = hashStr(snapStr);
      }

      persistNow();
      setHydrated(true);
      setSyncStatus("connected");

      const st = r.stats;
      const parts = [];
      parts.push(`시트에서 ${server.tabs.reduce((n, t) => n + t.rows.length, 0)}행을 읽었습니다.`);
      if (st.imported) parts.push(`새로 가져옴 ${st.imported}건`);
      if (st.fromSheet) parts.push(`시트 수정 반영 ${st.fromSheet}건`);
      if (st.removed) parts.push(`시트에서 지워진 ${st.removed}건 제외`);
      if (ops.length && !unverified) parts.push(`저장 ${ops.length}건`);
      if (st.mirror) parts.push(`'${MASTER_TAB_NAME}'의 복사본 ${st.mirror}행은 건너뜀`);
      if (st.unlinked) parts.push(`시트 탭 미연결 ${st.unlinked}건`);
      showInfo(notices.some((n) => n.level === "warn") ? "warn" : "ok", parts.join(" · "), notices.slice(0, 6), server, st);

      if (retry || appended > 0 || unverified) again.current = true;
      return true;
    } catch (e) {
      setSyncStatus("error");
      const msg = e && e.message === "OLD_SCRIPT"
        ? "연결은 됐지만 Apps Script 가 구버전입니다. 새 스크립트(v3)로 교체하고 '새 버전'으로 다시 배포해주세요. (저장은 멈춘 상태입니다)"
        : e && e.message && !/Failed to fetch|NetworkError|load failed|save failed|JSON/i.test(e.message)
        ? `동기화 실패: ${e.message}`
        : "구글 시트와 통신하지 못했습니다. URL과 배포 상태(액세스: 모든 사용자)를 확인해주세요. 변경 내용은 이 브라우저에 보관되며 연결되면 자동으로 이어서 저장됩니다.";
      showInfo("warn", msg);
      return false;
    } finally {
      busy.current = false;
      if (again.current) {
        again.current = false;
        clearTimeout(syncTimer.current);
        syncTimer.current = setTimeout(() => runCycle(), 1500);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 새로고침(마운트) 시 자동으로 시트를 읽고, 이후 45초마다 다른 사람의 변경을 확인
  useEffect(() => {
    if (!urlRef.current) { setHydrated(true); return undefined; }
    runCycle();
    const iv = setInterval(() => { if (typeof document === "undefined" || document.visibilityState !== "hidden") runCycle(); }, 45000);
    return () => { clearInterval(iv); clearTimeout(syncTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 로컬 백업 + 앱에서 값이 바뀌면 잠시 뒤 동기화
  useEffect(() => {
    persistNow();
    if (!firstLoadDone.current || !urlRef.current) return undefined;
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => runCycle(), 1200);
    return () => clearTimeout(syncTimer.current);
  }, [companies, familyPartners, deals, collection, fulfillment, legacySubmissions, organizers, financeGoalCash, financeGoalInKind, sheetConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateWebhookUrl(url) {
    setSheetConfig((c) => ({ ...c, webhookUrl: url }));
    urlRef.current = url;
    firstLoadDone.current = false;
    baseRef.current = {};
    setHydrated(false);
    setSyncStatus("disconnected");
    showInfo("warn", "URL이 바뀌었습니다. '시트에서 불러오기'를 눌러 연결을 확인해주세요.");
  }

  function loadNow() {
    if (!urlRef.current) { alert("먼저 Webhook URL을 입력해주세요."); return; }
    runCycle({ pullOnly: true }).then((ok) => { if (!ok) alert("구글 시트에서 데이터를 불러오지 못했습니다. Webhook URL과 배포 상태를 확인해주세요."); });
  }

  function syncNow() {
    if (!urlRef.current) { alert("먼저 Webhook URL을 입력해주세요."); return; }
    runCycle();
  }

  /* ---------- CRUD: Companies ---------- */
  const addCompany = useCallback((data) => setCompanies((prev) => [...prev, { ...emptyCompany(), ...data }]), []);
  const updateCompany = useCallback((id, patch) => setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c))), []);
  const deleteCompany = useCallback((id) => setCompanies((prev) => prev.filter((c) => c.id !== id)), []);

  /* ---------- CRUD: Family ---------- */
  const addFamily = useCallback((data) => setFamilyPartners((prev) => [...prev, { ...emptyFamily(), ...data }]), []);
  const updateFamily = useCallback((id, patch) => setFamilyPartners((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f))), []);
  const deleteFamily = useCallback((id) => setFamilyPartners((prev) => prev.filter((f) => f.id !== id)), []);

  /* ---------- CRUD: Deals ---------- */
  const addDeal = useCallback((data) => setDeals((prev) => [...prev, data]), []);
  const updateDeal = useCallback((id, patch) => setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d))), []);
  const deleteDeal = useCallback((id) => setDeals((prev) => prev.filter((d) => d.id !== id)), []);

  /* ---------- Checklists (자료 수합 / 이행 현황) ---------- */
  const setChecklistStatus = useCallback((kind, dealId, itemName, status) => {
    const setter = kind === "collection" ? setCollection : setFulfillment;
    setter((prev) => {
      const dealStore = { ...(prev[dealId] || {}) };
      dealStore[itemName] = { ...(dealStore[itemName] || {}), status };
      return { ...prev, [dealId]: dealStore };
    });
  }, []);
  const setChecklistNote = useCallback((kind, dealId, itemName, note) => {
    const setter = kind === "collection" ? setCollection : setFulfillment;
    setter((prev) => {
      const dealStore = { ...(prev[dealId] || {}) };
      dealStore[itemName] = { ...(dealStore[itemName] || {}), note };
      return { ...prev, [dealId]: dealStore };
    });
  }, []);

  /* ---------- 전역 브랜드명 목록 (중복 체크용) ---------- */
  const allBrandNames = useMemo(() => {
    return [
      ...companies.filter((c) => c.brandName.trim()).map((c) => ({ id: c.id, name: c.brandName.trim() })),
      ...familyPartners.filter((f) => f.brandName.trim()).map((f) => ({ id: f.id, name: f.brandName.trim() })),
    ];
  }, [companies, familyPartners]);

  /* ---------- Export / Import ---------- */
  function exportJson() {
    const data = { companies, familyPartners, deals, collection, fulfillment, legacySubmissions, organizers, financeGoalCash, financeGoalInKind, sheetConfig, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CR_대시보드_백업_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = migrateState(JSON.parse(e.target.result));
        const addRows = (data.companies ? data.companies.length : 0) + (data.familyPartners ? data.familyPartners.length : 0);
        if (addRows > 0 && !window.confirm(`백업 파일의 기업·패밀리 ${addRows}건은 구글 시트와 연결이 끊긴 새 항목으로 들어옵니다.\n시트에 없는 항목은 시트에 새 행으로 추가됩니다. 계속할까요?`)) return;
        if (data.companies) setCompanies(data.companies.map((c) => ({ ...c, sheet: null })));
        if (data.familyPartners) setFamilyPartners(data.familyPartners.map((f) => ({ ...f, sheet: null })));
        if (data.deals) setDeals(data.deals);
        if (data.collection) setCollection(data.collection);
        if (data.fulfillment) setFulfillment(data.fulfillment);
        if (data.legacySubmissions) setLegacySubmissions(data.legacySubmissions);
        if (data.organizers) setOrganizers(data.organizers);
        if (typeof data.financeGoalCash === "number") setFinanceGoalCash(data.financeGoalCash);
        if (typeof data.financeGoalInKind === "number") setFinanceGoalInKind(data.financeGoalInKind);
        if (data.sheetConfig) setSheetConfig(normalizeSheetConfig(data.sheetConfig));
        alert("데이터를 성공적으로 불러왔습니다.");
      } catch (err) {
        alert("파일을 읽는 중 오류가 발생했습니다. JSON 형식을 확인해주세요.");
      }
    };
    reader.readAsText(file);
  }

  function checklistCsv(kind) {
    const groups = kind === "collection" ? COLLECTION_GROUPS : FULFILLMENT_GROUPS;
    const store = kind === "collection" ? collection : fulfillment;
    const rows = deals.map((d) => {
      const row = { 브랜드명: d.brandName, 등급: (GRADE_CONFIG[d.grade] || {}).label || d.grade };
      groups.forEach((g) => g.items.forEach((item) => { row[item.name] = getStatus(store, d, item); }));
      return row;
    });
    return rows.length ? rows : [{ 안내: "데이터 없음" }];
  }

  function exportCsv() {
    const companyRows = companies.map((c) => ({
      구분: "서칭기업",
      등록자부서: c.ownerLabel,
      제안자명: c.proposerName || "",
      기업구분: c.category,
      현황: c.status,
      기업명: c.companyName,
      브랜드명: c.brandName,
      연락처: c.contact,
      설명: c.description,
      어필포인트: c.appeal,
    }));
    const familyRows = familyPartners.map((f) => ({
      구분: "패밀리파트너",
      기수: f.generation,
      뉴스레터현황: f.newsletter || "",
      협업횟수: f.collabCount,
      현황: f.status,
      기업명: f.companyName,
      브랜드명: f.brandName,
      연락처: f.contact,
      담당자: f.manager || "",
      비고: f.note,
    }));
    const dealRows = deals.map((d) => ({
      구분: "체결기업",
      브랜드명: d.brandName,
      담당자: d.managerName,
      확정일: d.confirmDate,
      등급: GRADE_CONFIG[d.grade].label,
      얼리버드: d.earlyBird ? "Y" : "N",
      패밀리파트너: d.isFamilyPartner ? "Y" : "N",
      실제현금: d.actualCash,
      실제현물: d.actualInKind,
      입금여부: d.paymentStatus,
      배송여부: d.deliveryStatus,
    }));

    const summaryRows = [{
      총목표현금: financeGoalCash,
      총목표현물: financeGoalInKind,
      실제현금합계: deals.reduce((s, d) => s + (Number(d.actualCash) || 0), 0),
      실제현물합계: deals.reduce((s, d) => s + (Number(d.actualInKind) || 0), 0),
    }];

    const csvParts = [
      "=== 서칭 / 타부서 제안 기업 ===",
      Papa.unparse(companyRows.length ? companyRows : [{ 안내: "데이터 없음" }]),
      "",
      "=== 패밀리 파트너 ===",
      Papa.unparse(familyRows.length ? familyRows : [{ 안내: "데이터 없음" }]),
      "",
      "=== 체결 및 재정 ===",
      Papa.unparse(dealRows.length ? dealRows : [{ 안내: "데이터 없음" }]),
      "",
      "=== 팀 목표 및 달성 요약 ===",
      Papa.unparse(summaryRows),
      "",
      "=== 자료 수합 현황 (O / X / 불필요) ===",
      Papa.unparse(checklistCsv("collection")),
      "",
      "=== 이행 현황 (O / X / 불필요) ===",
      Papa.unparse(checklistCsv("fulfillment")),
    ];
    const csvContent = "\uFEFF" + csvParts.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CR_대시보드_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const ctxValue = {
    companies, addCompany, updateCompany, deleteCompany,
    familyPartners, addFamily, updateFamily, deleteFamily,
    deals, addDeal, updateDeal, deleteDeal,
    collection, fulfillment, setChecklistStatus, setChecklistNote,
    organizers, setOrganizers,
    financeGoalCash, setFinanceGoalCash, financeGoalInKind, setFinanceGoalInKind,
    sheetConfig, updateWebhookUrl, syncStatus, syncNow, loadNow, sheetInfo,
    allBrandNames,
    exportJson, importJson, exportCsv,
  };

  return (
    <AppCtx.Provider value={ctxValue}>
      <div className="min-h-screen bg-slate-50 font-sans">
        <Header />
        <div className="max-w-7xl mx-auto px-4 py-5">
          <div className="flex flex-wrap gap-2 mb-5">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
                  activeTab === t.key
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {activeTab === "tab1" && <Tab1 />}
          {activeTab === "tab2" && <Tab2 />}
          {activeTab === "tab3" && <Tab3 />}
          {activeTab === "tab4" && <Tab4 />}
          {activeTab === "tab5" && <Tab5 />}
        </div>
      </div>
    </AppCtx.Provider>
  );
}
 