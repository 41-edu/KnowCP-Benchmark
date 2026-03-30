import type { PanoramaImage } from "../types";

interface ImageLightboxProps {
  images: PanoramaImage[];
  selectedIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function ImageLightbox({
  images,
  selectedIndex,
  onClose,
  onPrev,
  onNext,
}: ImageLightboxProps) {
  const image = images[selectedIndex];

  if (!image) {
    return null;
  }

  return (
    <div className="lightbox" onClick={onClose} role="presentation">
      <div className="lightbox-content" onClick={(event) => event.stopPropagation()}>
        <img src={image.imageUrl} alt={image.title} className="lightbox-image" />
        <div className="lightbox-toolbar">
          <button onClick={onPrev}>Previous</button>
          <span>
            {selectedIndex + 1} / {images.length}
          </span>
          <button onClick={onNext}>Next</button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
