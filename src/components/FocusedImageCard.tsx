import type { PanoramaImage } from "../types";
import { LoadableImage } from "./LoadableImage";

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
        <LoadableImage
          src={image.imageUrl}
          alt={image.title}
          className="focus-image-inner"
          wrapperClassName="focus-image blur-layer"
          loading="lazy"
        />
        <LoadableImage
          src={image.imageUrl}
          alt={image.title}
          className="focus-image-inner"
          wrapperClassName="focus-image clear-layer"
          wrapperStyle={focusStyle}
          loading="lazy"
        />
        <div className="focus-highlight" style={focusStyle} />
      </div>
      <span>{image.title}</span>
    </button>
  );
}
