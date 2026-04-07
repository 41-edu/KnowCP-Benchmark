import type { CSSProperties } from "react";
import { siteMeta } from "../data/siteContent";
import { useJsonContent } from "../hooks/useJsonContent";
import { useLocale } from "../hooks/useLocale";
import { resolvePublicUrl } from "../utils/url";

interface HeroLinkItem {
  label: string;
  target: string;
}

interface HeroConfig {
  title: string;
  subtitle: string;
  githubUrl: string;
  huggingFaceUrl: string;
  coverImage: string;
  heroHeight?: string;
  heroBgPosX?: string;
  heroBgPosY?: string;
  heroBgWidth?: string;
  heroBgHeight?: string;
  heroImageOpacity?: number;
  heroContentInsetLeft?: string;
  heroOverlayOpacity?: number;
  heroImageWashOpacity?: number;
  hfButtonColor?: string;
  navStyle?: "solid" | "glass";
  navItems?: HeroLinkItem[];
}

export function HeroSection() {
  const { locale, setLocale, t } = useLocale();
  const content = useJsonContent<HeroConfig>("/content/site-meta.json", siteMeta as HeroConfig);

  const heroStyle = {
    ["--hero-bg-image" as string]: `url(${resolvePublicUrl(content.coverImage)})`,
    ["--hero-height" as string]: content.heroHeight ?? "78vh",
    ["--hero-bg-pos-x" as string]: content.heroBgPosX ?? "50%",
    ["--hero-bg-pos-y" as string]: content.heroBgPosY ?? "42%",
    ["--hero-bg-width" as string]: content.heroBgWidth ?? "112%",
    ["--hero-bg-height" as string]: content.heroBgHeight ?? "auto",
    ["--hero-image-opacity" as string]: content.heroImageOpacity ?? 0.86,
    ["--hero-content-inset-left" as string]: content.heroContentInsetLeft ?? "clamp(20px, 4vw, 72px)",
    ["--hf-btn-color" as string]: content.hfButtonColor ?? "#ff8a00",
    ["--hero-overlay-opacity" as string]: content.heroOverlayOpacity ?? 0,
    ["--hero-image-wash-opacity" as string]: content.heroImageWashOpacity ?? 0.26,
  } as CSSProperties;

  const navItems = [
    { label: t("nav.top"), target: "#top" },
    { label: t("nav.introduction"), target: "#intro" },
    { label: t("nav.dataDistribution"), target: "#distribution" },
    { label: t("nav.questionDistribution"), target: "#question-distribution" },
    { label: t("nav.performance"), target: "#benchmark-performance" },
  ];

  return (
    <section className="hero-section hero-fullscreen" id="top" style={heroStyle}>
      <nav className={`top-nav ${content.navStyle === "solid" ? "solid" : "glass"}`}>
        <div className="top-nav-inner">
          <a href="#top" className="top-nav-brand">
            KnowCP
          </a>
          <div className="top-nav-links">
            {navItems.map((item) => (
              <a key={item.target} href={item.target}>
                {item.label}
              </a>
            ))}
            <div className="lang-switch" role="group" aria-label="Language Switcher">
              <button
                type="button"
                className={locale === "en" ? "active" : ""}
                onClick={() => setLocale("en")}
              >
                {t("hero.langEn")}
              </button>
              <button
                type="button"
                className={locale === "zh" ? "active" : ""}
                onClick={() => setLocale("zh")}
              >
                {t("hero.langZh")}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="hero-content">
        <h1>{t("hero.title", content.title)}</h1>
        <p className="hero-subtitle">{t("hero.subtitle", content.subtitle)}</p>
        <div className="hero-links">
          <a href={content.githubUrl} target="_blank" rel="noreferrer" className="github-secondary">
            <span>{t("hero.project")}</span>
            <img
              src={resolvePublicUrl("/content/GitHub_Invertocat_Black.svg")}
              alt="GitHub"
              className="hero-link-github-icon"
            />
          </a>
          <a href={content.huggingFaceUrl} target="_blank" rel="noreferrer" className="hf-primary">
            <span>{t("hero.dataset")}</span>
            <img
              src={resolvePublicUrl("/content/hf-logo.svg")}
              alt="Hugging Face"
              className="hero-link-hf-icon"
            />
          </a>
        </div>
      </div>
    </section>
  );
}
