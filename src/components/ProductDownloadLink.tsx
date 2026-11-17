"use client";

import { useEffect } from "react";

type Props = {
  href: string;
  productCode: string;
  productName: string;
  label: string;
};

function sessionId() {
  try {
    const key = "crm-product-analytics-session";
    let value = sessionStorage.getItem(key);
    if (!value) {
      value = crypto.randomUUID();
      sessionStorage.setItem(key, value);
    }
    return value;
  } catch {
    return "";
  }
}

function sendEvent(productCode: string, eventType: string) {
  if (!productCode) return;
  const payload = {
    product_code: productCode,
    event_type: eventType,
    session_id: sessionId(),
    source: "crm-catalog",
    medium: "web",
    landing_path: typeof location !== "undefined" ? location.pathname : "/",
    referrer: typeof document !== "undefined" ? document.referrer : ""
  };
  fetch("/api/analytics/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true
  }).catch(() => undefined);
}

export default function ProductDownloadLink({ href, productCode, productName, label }: Props) {
  useEffect(() => {
    sendEvent(productCode, "page_view");
  }, [productCode]);

  return (
    <a
      className="catalog-download"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => sendEvent(productCode, "download_click")}
      aria-label={"Descargar instalador de " + productName}
    >
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M4 8.5 21 6v17H4V8.5Zm20-2.8L44 3v20H24V5.7ZM4 25h17v17L4 39.5V25Zm20 0h20v20l-20-2.8V25Z" fill="currentColor" />
      </svg>
      <span><strong>DESCARGAR INSTALADOR</strong><small>{label}</small></span>
    </a>
  );
}
