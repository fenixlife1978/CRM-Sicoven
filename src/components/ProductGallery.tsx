"use client";

import { useState } from "react";

type MediaItem = { id: string; url: string; alt_text?: string | null; media_type?: "image" | "video" | null };

export default function ProductGallery({ images, productName }: { images: MediaItem[]; productName: string }) {
  const [active, setActive] = useState(0);
  if (!images.length) {
    return <div className="product-gallery-empty" aria-label={`Galería de ${productName}`}>
      <span aria-hidden="true">▧</span><p>Galería multimedia próximamente</p>
    </div>;
  }
  const current = images[Math.min(active, images.length - 1)];
  const isVideo = current.media_type === "video";
  return <div className="product-gallery" aria-label={`Galería multimedia de ${productName}`}>
    <div className="product-gallery-stage">
      {isVideo
        ? <video key={current.id} src={current.url} controls playsInline preload="metadata" aria-label={current.alt_text || `Video de ${productName}`} />
        : <img src={current.url} alt={current.alt_text || productName} loading="lazy" />}
      {images.length > 1 && <>
        <button type="button" className="gallery-arrow gallery-prev" aria-label="Archivo anterior" onClick={() => setActive((active + images.length - 1) % images.length)}>‹</button>
        <button type="button" className="gallery-arrow gallery-next" aria-label="Archivo siguiente" onClick={() => setActive((active + 1) % images.length)}>›</button>
      </>}
      <span className="gallery-counter">{active + 1} / {images.length}</span>
      {isVideo && <span className="gallery-media-type">VIDEO</span>}
    </div>
    {images.length > 1 && <div className="gallery-thumbnails">{images.map((item, index) =>
      <button type="button" key={item.id} className={index === active ? "active" : ""} aria-label={`Ver ${item.media_type === "video" ? "video" : "fotografía"} ${index + 1}`} aria-pressed={index === active} onClick={() => setActive(index)}>
        {item.media_type === "video" ? <span className="gallery-video-thumb">▶ VIDEO</span> : <img src={item.url} alt="" loading="lazy" />}
      </button>
    )}</div>}
    <style>{`
      .product-gallery-stage>video{display:block;width:100%;height:100%;object-fit:contain;background:#081a2d}
      .gallery-media-type{position:absolute;left:10px;bottom:10px;padding:4px 8px;border-radius:20px;background:rgba(9,35,66,.72);color:#fff;font-size:10px;font-weight:800}
      .gallery-video-thumb{display:grid;place-items:center;width:100%;height:100%;border-radius:3px;background:#10243a;color:#fff;font-size:9px;font-weight:800}
    `}</style>
  </div>;
}
