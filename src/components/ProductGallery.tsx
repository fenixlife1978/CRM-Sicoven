"use client";

import { useState } from "react";

type ImageItem = { id: string; url: string; alt_text?: string | null };

export default function ProductGallery({ images, productName }: { images: ImageItem[]; productName: string }) {
  const [active, setActive] = useState(0);
  if (!images.length) {
    return <div className="product-gallery-empty" aria-label={`Galería de ${productName}`}>
      <span aria-hidden="true">▧</span><p>Galería de imágenes próximamente</p>
    </div>;
  }
  const current = images[Math.min(active, images.length - 1)];
  return <div className="product-gallery" aria-label={`Galería de ${productName}`}>
    <div className="product-gallery-stage">
      <img src={current.url} alt={current.alt_text || productName} loading="lazy" />
      {images.length > 1 && <>
        <button type="button" className="gallery-arrow gallery-prev" aria-label="Fotografía anterior" onClick={() => setActive((active + images.length - 1) % images.length)}>‹</button>
        <button type="button" className="gallery-arrow gallery-next" aria-label="Fotografía siguiente" onClick={() => setActive((active + 1) % images.length)}>›</button>
      </>}
      <span className="gallery-counter">{active + 1} / {images.length}</span>
    </div>
    {images.length > 1 && <div className="gallery-thumbnails">{images.map((image, index) =>
      <button type="button" key={image.id} className={index === active ? "active" : ""} aria-label={`Ver fotografía ${index + 1}`} aria-pressed={index === active} onClick={() => setActive(index)}>
        <img src={image.url} alt="" loading="lazy" />
      </button>
    )}</div>}
  </div>;
}
