import type { PanoramaImage } from "../types";

interface FocusedImageCardProps {
  image: PanoramaImage;
  onClick: (image: PanoramaImage) => void;
}

export function FocusedImageCard({ image, onClick }: FocusedImageCardProps) {
  const bbox = image.bbox;
  const focusStyle = {
    left: `${bbox.x * 100}%`,
    top: `${bbox.y * 100}%`,
    width: `${bbox.width * 100}%`,
    height: `${bbox.height * 100}%`,
  };

  return (
    <button className="focus-card" onClick={() => onClick(image)}>
      <div className="focus-image-shell">
        <img src={image.imageUrl} alt={image.title} className="focus-image blur-layer" />
        <img src={image.imageUrl} alt={image.title} className="focus-image clear-layer" style={focusStyle} />
        <div className="focus-highlight" style={focusStyle} />
      </div>
      <span>{image.title}</span>
    </button>
  );
}
