import { useEffect, useState, type CSSProperties, type ImgHTMLAttributes } from "react";

interface LoadableImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "className"> {
  className?: string;
  wrapperClassName?: string;
  wrapperStyle?: CSSProperties;
  loadingText?: string;
  errorText?: string;
}

export function LoadableImage({
  src,
  alt,
  className,
  wrapperClassName,
  wrapperStyle,
  loadingText = "Loading...",
  errorText = "Failed to load",
  onLoad,
  onError,
  ...rest
}: LoadableImageProps) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    setState("loading");
  }, [src]);

  return (
    <div className={`loadable-image ${wrapperClassName || ""}`.trim()} style={wrapperStyle}>
      {state === "loading" && <div className="image-overlay loading">{loadingText}</div>}
      {state === "error" && <div className="image-overlay error">{errorText}</div>}
      <img
        {...rest}
        src={src}
        alt={alt}
        className={className}
        style={{ ...(rest.style || {}), opacity: state === "loaded" ? 1 : 0 }}
        onLoad={(event) => {
          setState("loaded");
          onLoad?.(event);
        }}
        onError={(event) => {
          setState("error");
          onError?.(event);
        }}
      />
    </div>
  );
}
