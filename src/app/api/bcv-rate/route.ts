import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
};

const BCV_TODAY_V1 = "https://bcv.today/api/v1/rate.json";
const BCV_TODAY_DEFAULT = "https://bcv.today/api/rate.json";
const DOLARAPI_FALLBACK = "https://ve.dolarapi.com/v1/dolares/oficial";

// In-memory cache for 60 seconds
let cachedData: {
  rate: number;
  effectiveDate: string;
  updatedAt: string;
  sourceUrl: string;
  timestamp: number;
} | null = null;

async function fetchFromUrl(url: string, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store"
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

export async function GET() {
  const now = Date.now();
  if (cachedData && now - cachedData.timestamp < 60000) {
    return NextResponse.json(cachedData, { headers: noStore });
  }

  // 1. Try https://bcv.today/api/v1/rate.json (used by tienda-marin.vercel.app)
  let raw = await fetchFromUrl(BCV_TODAY_V1);
  let source = BCV_TODAY_V1;

  // 2. Fallback to https://bcv.today/api/rate.json
  if (!raw || typeof raw.USD !== "number" || raw.USD <= 0) {
    raw = await fetchFromUrl(BCV_TODAY_DEFAULT);
    source = BCV_TODAY_DEFAULT;
  }

  // 3. Optional fallback to dolarapi
  if (!raw || (!raw.USD && !raw.promedio)) {
    const dolarRaw = await fetchFromUrl(DOLARAPI_FALLBACK);
    if (dolarRaw && typeof dolarRaw.promedio === "number" && dolarRaw.promedio > 0) {
      raw = {
        USD: dolarRaw.promedio,
        effective_date: dolarRaw.fechaActualizacion?.slice(0, 10),
        updated_at: dolarRaw.fechaActualizacion
      };
      source = DOLARAPI_FALLBACK;
    }
  }

  if (raw && typeof raw.USD === "number" && raw.USD > 0) {
    const rate = Number(raw.USD);
    const effectiveDate = String(raw.effective_date || raw.date || new Date().toISOString().slice(0, 10));
    const updatedAt = String(raw.updated_at || new Date().toISOString());

    cachedData = {
      rate,
      effectiveDate,
      updatedAt,
      sourceUrl: source,
      timestamp: now
    };

    return NextResponse.json(cachedData, { headers: noStore });
  }

  // Fallback if network is completely unreachable
  if (cachedData) {
    return NextResponse.json(cachedData, { headers: noStore });
  }

  return NextResponse.json(
    {
      rate: 889.26,
      effectiveDate: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString(),
      sourceUrl: "fallback-default",
      fallback: true
    },
    { headers: noStore }
  );
}
