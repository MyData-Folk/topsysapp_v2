import * as pdfjs from 'pdfjs-dist';
import { AppConfig, OccupancyData, DateLabel, HotelConfig, RoomType } from '../types';
import { DAYS_FR, MONTHS_FR, JOUR_ABBR, MONTH_MAP } from '../utils/constants';

// @ts-ignore
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

function groupByLine(items: any[]): string[] {
  const rows: Record<number, { x: number; str: string }[]> = {};
  items.forEach(it => {
    const y = Math.round(it.transform[5] / 5) * 5;
    if (!rows[y]) rows[y] = [];
    rows[y].push({ x: it.transform[4], str: it.str });
  });
  return Object.keys(rows)
    .sort((a, b) => Number(b) - Number(a))
    .map(y => rows[Number(y)].sort((a, b) => a.x - b.x).map(it => it.str).join(' '));
}

const extractNumbers = (str: string) => (str.match(/\b\d+\b/g) || []).map(Number);

function parseMonth(str: string): number {
  const lower = str.toLowerCase().replace(/[.]/g, '');
  if (lower.startsWith('juil')) return 6;
  if (lower.startsWith('juin')) return 5;
  const key = lower.substring(0, 3);
  return MONTH_MAP[key] ?? -1;
}

export async function detectEstablishmentName(buffer: ArrayBuffer): Promise<string | null> {
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const page = await pdf.getPage(1);
  const tc = await page.getTextContent();
  const lines = groupByLine(tc.items as any[]);

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    let line = lines[i].replace(/Mauvais arguments pour IF/g, '').trim();
    if (line.includes('PLANNING') || line.includes('TYPES') || line.includes('TOPSYS')) {
      const parts = line.split(/\b(?:PLANNING|TYPES|TOPSYS|Date\s*:)\b/i);
      const name = parts[0].trim();
      if (name.length > 3) line = name; else continue;
    }
    if (line && !line.includes("Planning d'Occupation") && !/^\d{2}\/\d{2}\/\d{4}$/.test(line) && !/^Réf\s*:/i.test(line) && line.length > 3) {
      return line;
    }
  }
  return null;
}

export async function autoDetectCategories(buffer: ArrayBuffer): Promise<RoomType[]> {
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const allLines: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    allLines.push(...groupByLine(tc.items as any[]));
  }

  const detected: RoomType[] = [];
  const seen = new Set<string>();
  let inDetail = false;

  for (const line of allLines) {
    const clean = line.trim();
    if (clean.includes('Détail par Type')) { inDetail = true; continue; }
    if (!inDetail || !clean) continue;
    const m = clean.match(/^(?:(\d+)\s*)?([A-Z0-9\-/]+)\b/);
    if (!m) continue;
    const cap = parseInt(m[1] || '0');
    const code = m[2];
    const skip = ['TOTAL', 'Saisons', 'Prix', 'Date', 'Libres', 'Non-Conf', 'Allotem', 'Détail', 'FICT', 'Jour'];
    if (skip.includes(code) || seen.has(code)) continue;
    const fullCode = cap > 0 ? `${cap} ${code}` : code;
    detected.push({ code: fullCode, label: code, description: `Détecté : ${code}`, capacity: cap });
    seen.add(code);
  }
  return detected;
}

export interface PdfScanResult {
  lines: string[];
  detectedName: string;
  detectedAddress: string;
  detectedTypes: RoomType[];
  detectedCapacity: number;
  suggestedIgnore: string[];
  allLineCategories: { line: string; category: 'type' | 'data' | 'ignore' | 'unknown' }[];
}

export async function scanPdfForWizard(buffer: ArrayBuffer): Promise<PdfScanResult> {
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const allLines: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    allLines.push(...groupByLine(tc.items as any[]));
  }

  let detectedName = '';
  let detectedAddress = '';
  const detectedTypes: RoomType[] = [];
  const seen = new Set<string>();
  const suggestedIgnore: string[] = [];

  const defaultIgnore = ['Saisons', 'Prix-réf', 'Scénarios', 'Evènem', 'Non-Conf', 'Allotem', 'Lib-Allot', '(c) Topsys', 'Mauvais', 'PLANNING', 'du SAM'];

  for (let i = 0; i < Math.min(allLines.length, 10); i++) {
    const line = allLines[i].replace(/Mauvais arguments pour IF/g, '').trim();
    if (!detectedName && line.length > 3) {
      if (line.includes('PLANNING') || line.includes('TYPES') || line.includes('Topsys')) {
        const parts = line.split(/\b(?:PLANNING|TYPES|Topsys|Ref\s*:)\b/i);
        const name = parts[0].trim();
        if (name.length > 3) detectedName = name;
      } else if (!line.includes("Planning d'Occupation") && !/^\d{2}\/\d{2}\/\d{4}$/.test(line) && !/^Réf\s*:/i.test(line)) {
        detectedName = line;
      }
    }
    if (!detectedAddress && detectedName && (/\d{5}/.test(line) || line.toUpperCase().includes('PARIS'))) {
      detectedAddress = line.split('Réf.')[0].trim();
    }
  }

  let inDetail = false;
  for (const line of allLines) {
    const clean = line.trim();
    if (clean.includes('Détail par Type')) { inDetail = true; continue; }
    if (!inDetail || !clean) continue;
    const m = clean.match(/^(?:(\d+)\s*)?([A-Z0-9\-/]+)\b/);
    if (!m) continue;
    const cap = parseInt(m[1] || '0');
    const code = m[2];
    const skip = ['TOTAL', 'Saisons', 'Prix', 'Date', 'Libres', 'Non-Conf', 'Allotem', 'Détail', 'Jour', 'FICT'];
    if (skip.includes(code) || seen.has(code)) continue;
    detectedTypes.push({ code: `${cap} ${code}`, label: code, description: `Détecté : ${code}`, capacity: cap });
    seen.add(code);
  }

  const detectedCapacity = detectedTypes.reduce((s, t) => s + t.capacity, 0);

  const allLineCategories = allLines.map(line => {
    const clean = line.trim();
    if (!clean) return { line: clean, category: 'ignore' as const };
    if (defaultIgnore.some(p => clean.startsWith(p))) return { line: clean, category: 'ignore' as const };
    if (/^Jour\s+/i.test(clean) || /^Date\s+/i.test(clean) || /^Libres\b/.test(clean) || /^\d+\s+FICT/.test(clean)) {
      return { line: clean, category: 'data' as const };
    }
    if (detectedTypes.some(t => clean.startsWith(t.code))) return { line: clean, category: 'type' as const };
    return { line: clean, category: 'unknown' as const };
  }).filter(l => l.line.length > 0);

  for (const lc of allLineCategories) {
    if (lc.category === 'unknown' && !defaultIgnore.some(p => lc.line.startsWith(p))) {
      const prefix = lc.line.split(/\s+/)[0];
      if (prefix && !suggestedIgnore.includes(prefix)) suggestedIgnore.push(prefix);
    }
  }

  return { lines: allLines, detectedName, detectedAddress, detectedTypes, detectedCapacity, suggestedIgnore, allLineCategories };
}

export async function parseTopsysPdf(buffer: ArrayBuffer, hotel: HotelConfig, config: AppConfig): Promise<OccupancyData> {
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  const allPages: string[][] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    allPages.push(groupByLine(tc.items as any[]));
  }

  return extractData(allPages, hotel, config);
}

function shouldIgnoreLine(line: string, ignoreList: string[]): boolean {
  for (const p of ignoreList) {
    if (line.startsWith(p)) return true;
    if (/^\d+\s+/.test(line) && line.replace(/^\d+\s+/, '').startsWith(p)) return true;
  }
  return false;
}

function extractData(pages: string[][], hotel: HotelConfig, config: AppConfig): OccupancyData {
  const ignoreList = hotel.ignorePrefixes || [];

  let periodStr = '';
  let startDate: Date | null = null;
  let jourRow: string[] = [];
  let dateRow: number[] = [];
  let priceRow: number[] = [];
  let nameExtracted = '';
  let addressExtracted = '';
  let editionDateExtracted = '';

  // Header scan
  for (const [pageIdx, lines] of pages.entries()) {
    for (const [lineIdx, rawLine] of lines.entries()) {
      const line = rawLine.replace(/Mauvais arguments pour IF/g, '').trim();
      if (!line) continue;

      // Edition date
      if (pageIdx === 0 && lineIdx < 5 && !editionDateExtracted) {
        const m = line.match(/(\d{2}\/\d{2}\/\d{4})\s+(?:à\s+)?(\d{2}:\d{2})/);
        if (m) editionDateExtracted = `${m[1]} à ${m[2]}`;
      }

      // Establishment name
      if (pageIdx === 0 && lineIdx < 10 && !nameExtracted) {
        let candidate = line;
        if (line.includes('PLANNING') || line.includes('TYPES') || line.includes('Topsys')) {
          candidate = line.split(/\b(?:PLANNING|TYPES|Topsys|Ref\s*:)\b/i)[0].trim();
        }
        if (candidate.length > 3 && !candidate.includes('PLANNING') && !candidate.includes('Topsys') && !/^Ref\s*:/i.test(candidate)) {
          nameExtracted = candidate;
          for (const nl of lines.slice(lineIdx + 1, lineIdx + 10)) {
            const cleanNl = nl.replace(/Mauvais arguments pour IF/g, '').trim();
            if (/\d{5}/.test(cleanNl) || cleanNl.toUpperCase().includes('PARIS')) {
              addressExtracted = cleanNl.split('Réf.')[0].trim();
              break;
            }
          }
        }
      }

      // Period (requires year)
      if (!periodStr && /\bdu\b/i.test(line)) {
        const matches = [...line.matchAll(/\b(\d{1,2})\s+([A-ZÉÈÊËÀÂÙÛÎÏa-zéèêëàâùûîï]{3,})\s+(\d{4})\b/gi)];
        if (matches.length >= 1) {
          periodStr = line;
          const [, d, mon, yr] = matches[0];
          const mi = parseMonth(mon);
          if (mi !== -1) startDate = new Date(parseInt(yr), mi, parseInt(d));
        }
      }

      // Jour row
      if (!jourRow.length && /^Jour\s+/i.test(line)) {
        jourRow = line.replace(/^Jour\s+/i, '').trim().split(/\s+/).filter(Boolean);
      }

      // Date row
      if (!dateRow.length && /^Date\s+/i.test(line)) {
        const ns = extractNumbers(line.replace(/^Date\s+/i, ''));
        if (ns.length >= 5) dateRow = ns;
      }

      // Price row
      if (!priceRow.length && /^Prix-réf\.\s*/i.test(line)) {
        priceRow = extractNumbers(line.replace(/^Prix-réf\.\s*/i, ''));
      }
    }
  }

  if (!dateRow.length) throw new Error('Structure PDF non reconnue (ligne "Date" introuvable)');

  const N = dateRow.length;

  // Build dateLabels
  const dateLabels: DateLabel[] = [];
  if (startDate) {
    let curMonth = startDate.getMonth();
    let curYear = startDate.getFullYear();
    let prevDay = -1;

    for (let i = 0; i < N; i++) {
      const dayNum = dateRow[i];
      if (dayNum < prevDay) { curMonth++; if (curMonth > 11) { curMonth = 0; curYear++; } }
      prevDay = dayNum;
      const d = new Date(curYear, curMonth, dayNum);
      let dowIndex = d.getDay();
      if (jourRow[i]) {
        const key = jourRow[i].toLowerCase().replace(/\./g, '').substring(0, 3);
        if (JOUR_ABBR[key] !== undefined) dowIndex = JOUR_ABBR[key];
      }
      const isWk = dowIndex === 0 || dowIndex === 6;
      const dd = String(dayNum).padStart(2, '0');
      dateLabels.push({
        full: `${DAYS_FR[dowIndex]} ${dd} ${MONTHS_FR[curMonth]}`,
        short: `${dd}/${String(curMonth + 1).padStart(2, '0')}`,
        day: `${DAYS_FR[dowIndex]} ${dd}`,
        isWk, date: d,
      });
    }
  } else {
    for (let i = 0; i < N; i++) {
      dateLabels.push({ full: `J${i + 1}`, short: `J${i + 1}`, day: `J${i + 1}`, isWk: false, date: null });
    }
  }

  // Extract values
  const libresType: Record<string, number[]> = {};
  const libresTotal = new Array(N).fill(0);
  const capaciteDay = new Array(N).fill(hotel.totalCapacity);
  const finalPrices = new Array(N).fill(priceRow[0] || 0);
  if (priceRow.length > 0) {
    for (let i = 0; i < N; i++) if (priceRow[i] !== undefined) finalPrices[i] = priceRow[i];
  }

  hotel.types.forEach(t => { libresType[t.code] = []; });

  for (const lines of pages) {
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];

      if (shouldIgnoreLine(line, ignoreList)) continue;

      // Libres total (source of truth — never overwrite later)
      if (/^Libres\b/.test(line)) {
        let vals = extractNumbers(line.substring('Libres'.length));
        if (vals.length < 5 && idx + 1 < lines.length) {
          const next = lines[idx + 1];
          if (!/^[A-Za-z]/.test(next)) vals = [...vals, ...extractNumbers(next)];
        }
        vals.slice(0, N).forEach((v, i) => { libresTotal[i] = v; });
        continue;
      }

      // Room types
      for (const type of hotel.types) {
        if (line.startsWith(type.code)) {
          let vals = extractNumbers(line.substring(type.code.length));
          if (vals.length < 5 && idx + 1 < lines.length) {
            const next = lines[idx + 1] || '';
            const isNextType = hotel.types.some(t => next.startsWith(t.code));
            if (!isNextType) vals = [...vals, ...extractNumbers(next)];
          }
          if (vals.length > 0 && vals.some(v => v > 0)) {
            libresType[type.code] = vals.slice(0, N);
          }
          break;
        }
      }
    }
  }

  // Compute occupied
  const occupied: Record<string, number[]> = {};
  hotel.types.forEach(t => {
    if (!libresType[t.code] || libresType[t.code].length === 0)
      libresType[t.code] = new Array(N).fill(t.capacity);
    while (libresType[t.code].length < N) libresType[t.code].push(t.capacity);
    occupied[t.code] = libresType[t.code].map(free => Math.max(0, t.capacity - free));
  });

  // Validation: compare sum of type-free vs PDF total (never overwrite libresTotal)
  const libresTypeSumCheck = new Array(N).fill(0);
  const validation = new Array(N).fill(true);
  for (let i = 0; i < N; i++) {
    libresTypeSumCheck[i] = hotel.types.reduce((s, t) => s + (libresType[t.code]?.[i] || 0), 0);
    validation[i] = libresTypeSumCheck[i] === libresTotal[i];
  }

  // If libresTotal was never populated from PDF, use recalculated
  if (libresTotal.every(v => v === 0)) {
    for (let i = 0; i < N; i++) libresTotal[i] = libresTypeSumCheck[i];
  }

  return {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    fileName: '',
    uploadDate: Date.now(),
    dateLabels,
    daysCount: N,
    occupied,
    libresType,
    libresTotal,
    libresTypeSumCheck,
    capaciteDay,
    validation,
    periodStr,
    prices: finalPrices,
    establishmentName: nameExtracted,
    establishmentAddress: addressExtracted,
    editionDate: editionDateExtracted,
  };
}
