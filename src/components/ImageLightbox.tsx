import type { PanoramaImage } from "../types";
import { useLocale } from "../hooks/useLocale";
import { LoadableImage } from "./LoadableImage";

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
  const { t } = useLocale();
  const image = images[selectedIndex];

  if (!image) {
    return null;
  }

  return (
    <div className="lightbox" onClick={onClose} role="presentation">
      <div className="lightbox-content" onClick={(event) => event.stopPropagation()}>
        <LoadableImage
          src={image.imageUrl}
          alt={image.title}
          className="lightbox-image"
          loadingText={t("common.loading")}
          errorText={t("common.loadFailed")}
        />
        <div className="lightbox-toolbar">
          <button onClick={onPrev}>{t("common.previous")}</button>
          <span>
            {selectedIndex + 1} / {images.length}
          </span>
          <button onClick={onNext}>{t("common.next")}</button>
          <button onClick={onClose}>{t("common.close")}</button>
        </div>
      </div>
    </div>
  );
}
