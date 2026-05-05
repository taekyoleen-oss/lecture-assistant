import PptxGenJs from 'pptxgenjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT  = path.join(__dirname, '..');
const OUT_DIR   = APP_ROOT;

function resolveOutputPath(dir, baseName = 'LectureAnnotationTool') {
  let candidate = path.join(dir, `${baseName}.pptx`);
  if (!fs.existsSync(candidate)) return candidate;
  let n = 2;
  while (true) {
    candidate = path.join(dir, `${baseName}_${n}.pptx`);
    if (!fs.existsSync(candidate)) return candidate;
    n++;
  }
}

// ── 슬라이드 실제 크기: LAYOUT_WIDE = 13.33" × 7.5" ──────
const SLIDE = { W: 13.33, H: 7.5 };
const L = {
  HDR: 1.00,
  Y0:  1.10,
  YB:  7.28,
  XL:  0.30,
  XR:  13.03,
};
L.W  = L.XR - L.XL;  // 12.73
L.AH = L.YB - L.Y0;  // 6.18

const C = {
  navy:  '1E3A5F',
  blue:  '2563EB',
  black: '111827',
  dark:  '374151',
  sub:   '6B7280',
  card:  'F9FAFB',
  border:'E5E7EB',
  white: 'FFFFFF',
};
const F = 'Noto Sans KR';

function calcCardH(startY, rows, gap = 0.10, margin = 0.02) {
  const available = (L.YB - margin) - startY;
  const cardH = (available - gap * (rows - 1)) / rows;
  return Math.max(cardH, 0.40);
}
function calcColW(cols, gap = 0.16) {
  return (L.W - gap * (cols - 1)) / cols;
}
function assertInBounds(y, h, label) {
  if (y + h > L.YB + 0.02)
    console.error(`❌ OVERFLOW [${label}]: ${(y+h).toFixed(3)} > ${L.YB}`);
}

function addHeader(s, pptx, num, title) {
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE.W, h: L.HDR,
    fill: { color: C.navy }, line: { color: C.navy },
  });
  const prefix = num > 0 ? `0${num}  ` : '';
  s.addText(`${prefix}${title}`, {
    x: L.XL, y: 0.10, w: L.W, h: L.HDR - 0.20,
    fontSize: 30, bold: true, color: C.white,
    fontFace: F, valign: 'middle', fit: 'shrink', wrap: false,
  });
}

function addCard(s, pptx, cx, cy, cw, ch, icon, title, desc) {
  assertInBounds(cy, ch, `card[${title}]`);
  s.addShape(pptx.ShapeType.rect, {
    x: cx, y: cy, w: cw, h: ch,
    fill: { color: C.card }, line: { color: C.border, width: 0.75 },
  });
  const PAD    = 0.16;
  const titleH = Math.min(ch * 0.36, 0.55);
  s.addText(`${icon}  ${title}`, {
    x: cx + PAD, y: cy + 0.12, w: cw - PAD*2, h: titleH,
    fontSize: 20, bold: true, color: C.black,
    fontFace: F, valign: 'top', fit: 'shrink', wrap: false,
  });
  const descY = cy + 0.12 + titleH + 0.06;
  const descH = Math.max(ch - 0.12 - titleH - 0.06 - 0.10, 0.25);
  assertInBounds(descY, descH, `desc[${title}]`);
  s.addText(desc, {
    x: cx + PAD, y: descY, w: cw - PAD*2, h: descH,
    fontSize: 15, color: C.dark, fontFace: F,
    valign: 'top', wrap: true, fit: 'shrink', lineSpacingMultiple: 1.2,
  });
}

// ════════════════════════════════════════════════════════════
const pptx = new PptxGenJs();
pptx.layout = 'LAYOUT_WIDE';  // 13.33 × 7.5

// ─────────────────────────────────────────────────────────
// 슬라이드 1 — 표지
// ─────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();

  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE.W, h: SLIDE.H,
    fill: { color: C.navy }, line: { color: C.navy },
  });
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE.W, h: 0.55,
    fill: { color: '162D4B' }, line: { color: '162D4B' },
  });
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: SLIDE.H - 1.30, w: SLIDE.W, h: 1.30,
    fill: { color: '162D4B' }, line: { color: '162D4B' },
  });

  s.addText('Lecture', {
    x: L.XL, y: 0.80, w: L.W, h: 1.40,
    fontSize: 80, bold: true, color: C.white,
    fontFace: F, valign: 'middle', fit: 'shrink',
  });
  s.addText('Annotation Tool', {
    x: L.XL, y: 2.10, w: L.W, h: 1.30,
    fontSize: 64, bold: true, color: '5FA8D3',
    fontFace: F, valign: 'middle', fit: 'shrink',
  });

  s.addShape(pptx.ShapeType.rect, {
    x: L.XL, y: 3.54, w: L.W, h: 0.04,
    fill: { color: '3A6A96' }, line: { color: '3A6A96' },
  });

  s.addText('강의 중 PDF 슬라이드 위에 실시간 주석을 그리는 브라우저 기반 어노테이션 도구', {
    x: L.XL, y: 3.68, w: L.W, h: 0.58,
    fontSize: 22, color: 'A5B4C8',
    fontFace: F, valign: 'middle', fit: 'shrink', wrap: true,
  });

  // 태그 4개 — 전체 폭 4등분
  const tags  = ['📄 PDF.js', '🎨 Canvas API', '⚡ Vanilla JS', '📁 단일 HTML 파일'];
  const tagW  = calcColW(4, 0.16);
  const tagY  = 4.48;
  const tagH  = 0.58;
  tags.forEach((tag, i) => {
    const tx = L.XL + i * (tagW + 0.16);
    s.addShape(pptx.ShapeType.rect, {
      x: tx, y: tagY, w: tagW, h: tagH,
      fill: { color: '2D4F73' }, line: { color: '3A6A96' },
    });
    s.addText(tag, {
      x: tx, y: tagY, w: tagW, h: tagH,
      fontSize: 18, color: C.white,
      fontFace: F, align: 'center', valign: 'middle', fit: 'shrink',
    });
  });

  s.addText('2026', {
    x: L.XL, y: SLIDE.H - 1.20, w: 3.00, h: 1.00,
    fontSize: 18, color: '7A99B4', fontFace: F, valign: 'middle',
  });
  s.addText('바이브코딩랩  ·  vibecodinglab.ai.kr', {
    x: L.XR - 5.00, y: SLIDE.H - 1.20, w: 5.00, h: 1.00,
    fontSize: 18, color: '7A99B4',
    fontFace: F, align: 'right', valign: 'middle', fit: 'shrink',
  });
}

// ─────────────────────────────────────────────────────────
// 슬라이드 2 — 목차
// ─────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addHeader(s, pptx, 0, 'Contents  목차');

  const items = [
    { num: '01', title: '앱 개요',       sub: '목적 · 대상 사용자 · 핵심 특징' },
    { num: '02', title: '화면 구성',     sub: 'IDLE 화면 · PRESENTING 모드' },
    { num: '03', title: '그리기 도구',   sub: '7가지 도구 상세 설명' },
    { num: '04', title: '색상 & 두께',   sub: '4가지 색상 팔레트 · 선 두께 슬라이더' },
    { num: '05', title: '사용 방법',     sub: '7단계 Step by Step 가이드' },
    { num: '06', title: '키보드 단축키', sub: '도구 전환 · 슬라이드 이동 · 전체화면' },
    { num: '07', title: '기술 스택',     sub: 'Vanilla JS · PDF.js · Canvas API · Docker' },
  ];

  const startY = L.Y0 + 0.04;
  const GAP    = 0.06;
  const rowH   = calcCardH(startY, items.length, GAP, 0.02);
  const NUM_W  = 0.70;
  const NB_GAP = 0.10;
  const BOX_W  = L.W - NUM_W - NB_GAP;

  items.forEach((item, i) => {
    const cy = startY + i * (rowH + GAP);
    assertInBounds(cy, rowH, `toc-${i}`);

    s.addShape(pptx.ShapeType.rect, {
      x: L.XL, y: cy, w: NUM_W, h: rowH,
      fill: { color: C.navy }, line: { color: C.navy },
    });
    s.addText(item.num, {
      x: L.XL, y: cy, w: NUM_W, h: rowH,
      fontSize: 18, bold: true, color: C.white,
      fontFace: F, align: 'center', valign: 'middle', fit: 'shrink',
    });
    s.addShape(pptx.ShapeType.rect, {
      x: L.XL + NUM_W + NB_GAP, y: cy, w: BOX_W, h: rowH,
      fill: { color: C.card }, line: { color: C.border, width: 0.75 },
    });
    const tH = rowH * 0.52;
    s.addText(item.title, {
      x: L.XL + NUM_W + NB_GAP + 0.18, y: cy + 0.05, w: BOX_W - 0.36, h: tH,
      fontSize: 18, bold: true, color: C.black,
      fontFace: F, valign: 'top', fit: 'shrink',
    });
    s.addText(item.sub, {
      x: L.XL + NUM_W + NB_GAP + 0.18, y: cy + tH + 0.03, w: BOX_W - 0.36, h: rowH - tH - 0.08,
      fontSize: 14, color: C.sub,
      fontFace: F, valign: 'top', fit: 'shrink', wrap: false,
    });
  });
}

// ─────────────────────────────────────────────────────────
// 슬라이드 3 — 앱 개요
// ─────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addHeader(s, pptx, 1, '앱 개요');

  s.addText('강사를 위한 PDF 강의자료 실시간 주석 도구', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.36,
    fontSize: 18, color: C.sub, fontFace: F, valign: 'top', fit: 'shrink',
  });

  const cardStartY = L.Y0 + 0.44;
  const GAP  = 0.16;
  const colW = calcColW(2, GAP);
  const cardH = calcCardH(cardStartY, 2, 0.14, 0.02);

  const cards = [
    { col:0, row:0, icon:'🎯', title:'목적',
      desc:'강의 중 PDF 슬라이드 위 실시간 주석\n발표 흐름을 유지하며 핵심 내용 시각적으로 강조' },
    { col:1, row:0, icon:'👩‍🏫', title:'대상 사용자',
      desc:'강사 · 교육자 · 발표자\nPDF로 변환한 강의자료를 활용하는 모든 사용자' },
    { col:0, row:1, icon:'⚡', title:'핵심 특징',
      desc:'설치 불필요 — 브라우저에서 즉시 실행\n단일 index.html 파일 하나로 완결' },
    { col:1, row:1, icon:'🔒', title:'완전 로컬',
      desc:'서버 통신 없음 · 외부 API 없음\n파일은 브라우저 메모리 안에서만 처리' },
  ];

  for (const card of cards) {
    const cx = L.XL + card.col * (colW + GAP);
    const cy = cardStartY + card.row * (cardH + 0.14);
    addCard(s, pptx, cx, cy, colW, cardH, card.icon, card.title, card.desc);
  }
}

// ─────────────────────────────────────────────────────────
// 슬라이드 4 — 화면 구성
// ─────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addHeader(s, pptx, 2, '화면 구성');

  s.addText('단일 페이지 · 두 가지 모드 전환', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.34,
    fontSize: 18, color: C.sub, fontFace: F, valign: 'top', fit: 'shrink',
  });

  const cardStartY = L.Y0 + 0.42;
  const GAP        = 0.16;
  const colW       = calcColW(2, GAP);
  const cardH      = calcCardH(cardStartY, 1, 0, 0.02);

  const listItemsIdle = [
    '📂  PDF 드래그&드롭 영역 (화면 전체)',
    '📁  파일 선택 버튼',
    '⚠️  비PDF 파일 → 오류 토스트 표시',
    '🔒  암호화 PDF → 비밀번호 입력 프롬프트',
    '⏳  로딩 스피너 + "PDF 로딩 중..." 표시',
    '🌙  라이트 / 다크 테마 토글',
    '🦶  바이브코딩랩 푸터 (PRESENTING 시 숨김)',
  ];
  const listItemsPres = [
    '📐  PDF 슬라이드 전체화면 렌더링',
    '✏️  Canvas 오버레이 — 7가지 그리기 도구',
    '📌  우측 고정 툴바 (도구 · 색상 · 두께)',
    '⬇️  하단 컨트롤 바 (이전 / 다음 / 페이지)',
    '💾  PNG 저장 (PDF + 주석 합성 다운로드)',
    '⌨️  키보드 단축키 풀 지원',
    '🖥️  전체화면 API 토글 (F키)',
  ];

  const renderListCard = (xStart, headerColor, headerLabel, items) => {
    s.addShape(pptx.ShapeType.rect, {
      x: xStart, y: cardStartY, w: colW, h: cardH,
      fill: { color: C.card }, line: { color: headerColor, width: 1.5 },
    });
    s.addText(headerLabel, {
      x: xStart + 0.16, y: cardStartY + 0.12, w: colW - 0.32, h: 0.50,
      fontSize: 22, bold: true, color: headerColor,
      fontFace: F, valign: 'top', fit: 'shrink',
    });
    const listStartY = cardStartY + 0.70;
    const itemH = (cardH - 0.70 - 0.10) / items.length;
    items.forEach((item, i) => {
      const iy = listStartY + i * itemH;
      assertInBounds(iy, itemH, `list-${i}`);
      s.addText(item, {
        x: xStart + 0.20, y: iy, w: colW - 0.40, h: itemH,
        fontSize: 15, color: C.dark, fontFace: F,
        valign: 'middle', fit: 'shrink', wrap: false,
      });
    });
  };

  renderListCard(L.XL, C.navy, '🏠  IDLE 화면', listItemsIdle);
  renderListCard(L.XL + colW + GAP, C.blue, '🎬  PRESENTING 모드', listItemsPres);
}

// ─────────────────────────────────────────────────────────
// 슬라이드 5 — 그리기 도구
// ─────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addHeader(s, pptx, 3, '그리기 도구');

  s.addText('7가지 도구 · 숫자키 1~7로 즉시 전환', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.34,
    fontSize: 18, color: C.sub, fontFace: F, valign: 'top', fit: 'shrink',
  });

  const tools = [
    { icon:'✏️',  title:'펜 (1)',       desc:'자유 곡선 드로잉\n마우스/터치 경로 그대로 기록' },
    { icon:'➡️',  title:'화살표 (2)',   desc:'드래그 방향으로 화살표\n채운 삼각형 화살촉' },
    { icon:'⭕',  title:'동그라미 (3)', desc:'드래그 범위에 내접 타원\nPowerPoint 동일 방식' },
    { icon:'⬜',  title:'네모 (4)',     desc:'드래그로 사각형 영역\n윤곽선만 표시' },
    { icon:'🅣',  title:'텍스트 (5)',   desc:'클릭 위치에 인라인 입력\n바깥 클릭 시 Canvas 고정' },
    { icon:'🖊️', title:'형광펜 (6)',   desc:'반투명 색상으로 강조\n넓은 선폭 자동 적용' },
    { icon:'⌫',  title:'지우개 (7)',   desc:'픽셀 단위 삭제\neraser stroke로 저장·재현' },
  ];

  const cardStartY = L.Y0 + 0.42;
  const ROW_GAP    = 0.14;
  const cardH      = calcCardH(cardStartY, 2, ROW_GAP, 0.02);

  // row 0: 4개 — 전체 폭 4등분
  const GAP4  = 0.14;
  const colW4 = calcColW(4, GAP4);
  tools.slice(0, 4).forEach((t, i) => {
    addCard(s, pptx, L.XL + i*(colW4+GAP4), cardStartY, colW4, cardH, t.icon, t.title, t.desc);
  });

  // row 1: 3개 — 전체 폭 3등분 (공백 없음)
  const GAP3  = 0.16;
  const colW3 = calcColW(3, GAP3);
  tools.slice(4, 7).forEach((t, i) => {
    addCard(s, pptx, L.XL + i*(colW3+GAP3), cardStartY+cardH+ROW_GAP, colW3, cardH, t.icon, t.title, t.desc);
  });
}

// ─────────────────────────────────────────────────────────
// 슬라이드 6 — 색상 & 두께
// ─────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addHeader(s, pptx, 4, '색상 & 두께 설정');

  s.addText('4가지 색상 · 선 두께 슬라이더 · localStorage 자동 저장', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.34,
    fontSize: 18, color: C.sub, fontFace: F, valign: 'top', fit: 'shrink',
  });

  const colorStartY = L.Y0 + 0.44;
  const colorCardH  = 3.00;
  const GAP4c       = 0.16;
  const colW4c      = calcColW(4, GAP4c);

  const colors = [
    { name:'Red',        hex:'FF3333', label:'#FF3333', desc:'강조 · 중요 표시' },
    { name:'Yellow',     hex:'FFE033', label:'#FFE033', desc:'노트 · 메모 강조' },
    { name:'Lime Green', hex:'84CC16', label:'#84CC16', desc:'긍정 · 정답 표시' },
    { name:'Blue',       hex:'3B82F6', label:'#3B82F6', desc:'보조 설명 · 링크' },
  ];

  assertInBounds(colorStartY, colorCardH, 'color-cards');
  colors.forEach((c, i) => {
    const cx = L.XL + i*(colW4c+GAP4c);
    s.addShape(pptx.ShapeType.rect, {
      x: cx, y: colorStartY, w: colW4c, h: colorCardH,
      fill: { color: C.card }, line: { color: C.border, width: 0.75 },
    });
    const swatchH = colorCardH * 0.54;
    s.addShape(pptx.ShapeType.rect, {
      x: cx+0.12, y: colorStartY+0.12, w: colW4c-0.24, h: swatchH,
      fill: { color: c.hex }, line: { color: C.border },
    });
    s.addText(c.name, {
      x: cx+0.10, y: colorStartY+0.12+swatchH+0.10, w: colW4c-0.20, h: 0.38,
      fontSize: 17, bold: true, color: C.black,
      fontFace: F, align: 'center', valign: 'top', fit: 'shrink',
    });
    s.addText(c.label, {
      x: cx+0.10, y: colorStartY+0.12+swatchH+0.52, w: colW4c-0.20, h: 0.30,
      fontSize: 14, color: C.sub,
      fontFace: 'Courier New', align: 'center', valign: 'top', fit: 'shrink',
    });
    s.addText(c.desc, {
      x: cx+0.10, y: colorStartY+0.12+swatchH+0.84, w: colW4c-0.20,
      h: colorCardH - 0.12 - swatchH - 0.84 - 0.10,
      fontSize: 14, color: C.dark,
      fontFace: F, align: 'center', valign: 'top', fit: 'shrink', wrap: true,
    });
  });

  // 두께 섹션 — 전체 폭 사용
  const thickY = colorStartY + colorCardH + 0.18;
  const thickH = L.YB - thickY - 0.02;
  assertInBounds(thickY, thickH, 'thick');
  s.addShape(pptx.ShapeType.rect, {
    x: L.XL, y: thickY, w: L.W, h: thickH,
    fill: { color: C.card }, line: { color: C.border, width: 0.75 },
  });
  s.addText('🎚️  선 두께 슬라이더', {
    x: L.XL+0.20, y: thickY+0.10, w: 4.50, h: 0.40,
    fontSize: 19, bold: true, color: C.black, fontFace: F, valign: 'top', fit: 'shrink',
  });
  s.addText('기본값 4px  ·  슬라이더로 선 굵기 조절  ·  선택 값은 localStorage에 자동 저장  ·  앱 재시작 시 자동 복원', {
    x: L.XL+0.20, y: thickY+0.52, w: L.W-0.40, h: thickH-0.52-0.08,
    fontSize: 15, color: C.dark, fontFace: F,
    valign: 'top', fit: 'shrink', wrap: true,
  });
}

// ─────────────────────────────────────────────────────────
// 슬라이드 7 — 사용 방법
// ─────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addHeader(s, pptx, 5, '사용 방법');

  const steps = [
    { num:'1', title:'PDF 준비',      desc:'PowerPoint / Keynote / Google Slides → PDF로 내보내기' },
    { num:'2', title:'HTML 열기',     desc:'브라우저에서 index.html 파일 열기 (설치 불필요)' },
    { num:'3', title:'PDF 로드',      desc:'파일을 화면에 드래그&드롭 하거나 클릭해서 선택' },
    { num:'4', title:'도구 선택',     desc:'우측 툴바에서 도구 · 색상 · 두께 선택 (숫자키 1~7)' },
    { num:'5', title:'그리기',        desc:'캔버스 위에서 마우스/터치로 자유롭게 주석 추가' },
    { num:'6', title:'슬라이드 이동', desc:'← → 방향키 또는 하단 버튼 · 주석은 페이지별 자동 보존' },
    { num:'7', title:'PNG 저장',      desc:'하단 💾 버튼 → slide-N.png 다운로드 (PDF + 주석 합성)' },
  ];

  const startY   = L.Y0 + 0.04;
  const GAP      = 0.06;
  const rowH     = calcCardH(startY, steps.length, GAP, 0.02);
  const CIRCLE_D = Math.min(rowH * 0.72, 0.52);
  const TITLE_W  = 2.60;
  const DIV_GAP  = 0.20;

  steps.forEach((step, i) => {
    const cy = startY + i*(rowH+GAP);
    assertInBounds(cy, rowH, `step-${i}`);

    const circleY = cy + (rowH - CIRCLE_D) / 2;
    s.addShape(pptx.ShapeType.ellipse, {
      x: L.XL, y: circleY, w: CIRCLE_D, h: CIRCLE_D,
      fill: { color: C.navy }, line: { color: C.navy },
    });
    s.addText(step.num, {
      x: L.XL, y: circleY, w: CIRCLE_D, h: CIRCLE_D,
      fontSize: 17, bold: true, color: C.white,
      fontFace: F, align: 'center', valign: 'middle', fit: 'shrink',
    });

    const boxX = L.XL + CIRCLE_D + 0.10;
    const boxW = L.XR - boxX;
    s.addShape(pptx.ShapeType.rect, {
      x: boxX, y: cy, w: boxW, h: rowH,
      fill: { color: C.card }, line: { color: C.border, width: 0.75 },
    });
    s.addText(step.title, {
      x: boxX+0.16, y: cy+0.04, w: TITLE_W, h: rowH-0.08,
      fontSize: 17, bold: true, color: C.navy,
      fontFace: F, valign: 'middle', fit: 'shrink',
    });
    s.addShape(pptx.ShapeType.rect, {
      x: boxX+TITLE_W+DIV_GAP*0.5, y: cy+rowH*0.15,
      w: 0.02, h: rowH*0.70,
      fill: { color: C.border }, line: { color: C.border },
    });
    const descX = boxX + TITLE_W + DIV_GAP;
    s.addText(step.desc, {
      x: descX, y: cy+0.04, w: L.XR - descX, h: rowH-0.08,
      fontSize: 15, color: C.dark,
      fontFace: F, valign: 'middle', fit: 'shrink', wrap: true,
    });
  });
}

// ─────────────────────────────────────────────────────────
// 슬라이드 8 — 키보드 단축키
// ─────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addHeader(s, pptx, 6, '키보드 단축키');

  s.addText('마우스 없이 모든 기능 제어 가능', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.34,
    fontSize: 18, color: C.sub, fontFace: F, valign: 'top', fit: 'shrink',
  });

  const groups = [
    {
      title: '🔧 도구 선택',
      items: [
        {key:'1', action:'펜'},
        {key:'2', action:'화살표'},
        {key:'3', action:'동그라미'},
        {key:'4', action:'네모'},
        {key:'5', action:'텍스트'},
        {key:'6', action:'형광펜'},
        {key:'7', action:'지우개'},
      ],
    },
    {
      title: '📄 슬라이드 & 화면',
      items: [
        {key:'←',   action:'이전 슬라이드'},
        {key:'→',   action:'다음 슬라이드'},
        {key:'Esc', action:'현재 슬라이드 주석 초기화'},
        {key:'F',   action:'전체화면 토글'},
      ],
    },
  ];

  const startY = L.Y0 + 0.42;
  const GAP    = 0.16;
  const colW   = calcColW(2, GAP);
  const colH   = L.YB - startY - 0.02;

  groups.forEach((group, gi) => {
    const cx = L.XL + gi*(colW+GAP);
    s.addShape(pptx.ShapeType.rect, {
      x: cx, y: startY, w: colW, h: colH,
      fill: { color: C.card }, line: { color: C.border, width: 0.75 },
    });
    s.addText(group.title, {
      x: cx+0.18, y: startY+0.14, w: colW-0.36, h: 0.44,
      fontSize: 20, bold: true, color: C.navy,
      fontFace: F, valign: 'top', fit: 'shrink',
    });

    const listStartY = startY + 0.14 + 0.44 + 0.12;
    const areaH      = colH - 0.14 - 0.44 - 0.12 - 0.12;
    const itemH      = areaH / group.items.length;
    const BADGE_W    = 0.72;

    group.items.forEach((item, i) => {
      const iy = listStartY + i*itemH;
      assertInBounds(iy, itemH, `sc-${gi}-${i}`);

      s.addShape(pptx.ShapeType.rect, {
        x: cx+0.18, y: iy+(itemH-0.34)/2, w: BADGE_W, h: 0.34,
        fill: { color: C.navy }, line: { color: C.navy },
      });
      s.addText(item.key, {
        x: cx+0.18, y: iy+(itemH-0.34)/2, w: BADGE_W, h: 0.34,
        fontSize: 14, bold: true, color: C.white,
        fontFace: 'Courier New', align: 'center', valign: 'middle', fit: 'shrink',
      });
      s.addText(item.action, {
        x: cx+0.18+BADGE_W+0.12, y: iy,
        w: colW - 0.18 - BADGE_W - 0.12 - 0.14, h: itemH,
        fontSize: 16, color: C.dark,
        fontFace: F, valign: 'middle', fit: 'shrink',
      });
    });
  });
}

// ─────────────────────────────────────────────────────────
// 슬라이드 9 — 기술 스택
// ─────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();
  addHeader(s, pptx, 7, '기술 스택');

  s.addText('외부 의존성 최소화 · 브라우저 네이티브 API 활용', {
    x: L.XL, y: L.Y0, w: L.W, h: 0.34,
    fontSize: 18, color: C.sub, fontFace: F, valign: 'top', fit: 'shrink',
  });

  const techCards = [
    { icon:'📄', title:'PDF.js (CDN)',
      desc:'Mozilla 공식 PDF 렌더링 라이브러리\nv3.11.174 · Eager 전체 페이지 렌더링\n암호화 PDF 지원 (onPassword 콜백)' },
    { icon:'🎨', title:'HTML5 Canvas',
      desc:'두 레이어 분리: pdf-layer / draw-layer\ndestination-out 합성으로 지우개 구현\n좌표 0~1 정규화 저장 (해상도 독립)' },
    { icon:'⚡', title:'Vanilla JS',
      desc:'순수 JS (프레임워크 없음)\nasync/await 패턴 통일\n6개 모듈: PDFRenderer, StrokeStore 외' },
    { icon:'🖥️', title:'배포',
      desc:'단일 index.html — 로컬 파일 즉시 실행\nDocker + Express 서버 배포 지원\nGitHub Pages 정적 배포 가능' },
  ];

  const cardStartY = L.Y0 + 0.44;
  const GAP        = 0.16;
  const colW       = calcColW(2, GAP);
  const cardH      = calcCardH(cardStartY, 2, 0.14, 0.02);

  [
    {col:0,row:0},{col:1,row:0},
    {col:0,row:1},{col:1,row:1},
  ].forEach((pos, i) => {
    const cx = L.XL + pos.col*(colW+GAP);
    const cy = cardStartY + pos.row*(cardH+0.14);
    addCard(s, pptx, cx, cy, colW, cardH, techCards[i].icon, techCards[i].title, techCards[i].desc);
  });
}

// ─────────────────────────────────────────────────────────
// 슬라이드 10 — 마무리
// ─────────────────────────────────────────────────────────
{
  const s = pptx.addSlide();

  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE.W, h: SLIDE.H,
    fill: { color: C.navy }, line: { color: C.navy },
  });
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE.W, h: 0.55,
    fill: { color: '162D4B' }, line: { color: '162D4B' },
  });
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: SLIDE.H - 1.30, w: SLIDE.W, h: 1.30,
    fill: { color: '162D4B' }, line: { color: '162D4B' },
  });

  s.addText('Lecture Annotation Tool', {
    x: L.XL, y: 0.80, w: L.W, h: 1.10,
    fontSize: 46, bold: true, color: C.white,
    fontFace: F, valign: 'middle', fit: 'shrink', wrap: false,
  });
  s.addText('강사를 위한 가장 가벼운 실시간 PDF 주석 도구', {
    x: L.XL, y: 2.00, w: L.W, h: 0.54,
    fontSize: 22, color: 'A5B4C8',
    fontFace: F, valign: 'middle', fit: 'shrink', wrap: true,
  });

  s.addShape(pptx.ShapeType.rect, {
    x: L.XL, y: 2.68, w: L.W, h: 0.04,
    fill: { color: '3A6A96' }, line: { color: '3A6A96' },
  });

  // 요약 카드 3개 — 전체 폭 3등분
  const summaries = [
    { icon:'📁', title:'단일 파일',   desc:'index.html 하나로\n즉시 실행' },
    { icon:'🎨', title:'7가지 도구',  desc:'펜·화살표·도형·텍스트\n형광펜·지우개' },
    { icon:'⌨️', title:'단축키 완비', desc:'슬라이드 이동·초기화\n전체화면·PNG 저장' },
  ];

  const sumStartY = 2.84;
  const sumH      = SLIDE.H - 1.30 - sumStartY - 0.10;
  const GAP3s     = 0.16;
  const sumW      = calcColW(3, GAP3s);

  summaries.forEach((sum, i) => {
    const sx = L.XL + i*(sumW+GAP3s);
    assertInBounds(sumStartY, sumH, `sum-${i}`);
    s.addShape(pptx.ShapeType.rect, {
      x: sx, y: sumStartY, w: sumW, h: sumH,
      fill: { color: '2D4F73' }, line: { color: '3A6A96' },
    });
    s.addText(sum.icon, {
      x: sx, y: sumStartY+0.14, w: sumW, h: 0.60,
      fontSize: 32, align: 'center', valign: 'top',
      fontFace: 'Segoe UI Emoji', fit: 'shrink',
    });
    s.addText(sum.title, {
      x: sx+0.12, y: sumStartY+0.80, w: sumW-0.24, h: 0.44,
      fontSize: 19, bold: true, color: C.white,
      fontFace: F, align: 'center', valign: 'top', fit: 'shrink',
    });
    s.addText(sum.desc, {
      x: sx+0.12, y: sumStartY+1.26, w: sumW-0.24, h: sumH-1.26-0.10,
      fontSize: 16, color: 'A5B4C8',
      fontFace: F, align: 'center', valign: 'top', fit: 'shrink', wrap: true,
      lineSpacingMultiple: 1.2,
    });
  });

  s.addText('🚀 바이브코딩랩  ·  vibecodinglab.ai.kr', {
    x: L.XL, y: SLIDE.H - 1.20, w: L.W, h: 1.00,
    fontSize: 18, color: '7A99B4',
    fontFace: F, align: 'center', valign: 'middle', fit: 'shrink',
  });
}

// ── 파일 저장 ─────────────────────────────────────────────
const outputPath = resolveOutputPath(OUT_DIR, 'LectureAnnotationTool');
await pptx.writeFile({ fileName: outputPath });
console.log(`✅ PPT 저장 완료: ${outputPath}`);
