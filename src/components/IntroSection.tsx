import { useJsonContent } from "../hooks/useJsonContent";
import { useLocale } from "../hooks/useLocale";

interface IntroCapability {
  id: string;
  title: string;
  description: string;
}

const fallbackIntro: IntroCapability[] = [
  {
    id: "cap-detection",
    title: "Visual Detection",
    description:
      "Evaluate localized understanding of seals, inscriptions, objects, and technique regions with box-aware questions.",
  },
  {
    id: "cap-understanding",
    title: "Visual Understanding",
    description:
      "Evaluate recognition and reasoning from image-level and region-level evidence across structured question formats.",
  },
  {
    id: "cap-culture",
    title: "Vision-Culture Integration",
    description:
      "Evaluate culturally grounded interpretation by combining visual evidence with art-historical and textual context.",
  },
];

export function IntroSection() {
  const { t, locale } = useLocale();
  const introCapabilities = useJsonContent<IntroCapability[]>(
    "/content/intro-capabilities.json",
    fallbackIntro,
  );
  const introduction = useJsonContent<{ description: string }>("/content/introduction.json", {
    description: t("intro.fallbackDescription"),
  });

  const capabilityFallbackMap: Record<string, { title: string; description: string }> = {
    "cap-detection": {
      title: t("intro.detectionTitle"),
      description: t("intro.detectionDesc"),
    },
    "cap-understanding": {
      title: t("intro.understandingTitle"),
      description: t("intro.understandingDesc"),
    },
    "cap-culture": {
      title: t("intro.cultureTitle"),
      description: t("intro.cultureDesc"),
    },
  };

  return (
    <section className="section-block" id="intro">
      <div className="section-head center-head">
        <h2>{t("intro.title")}</h2>
        <p>{locale === "zh" ? t("intro.fallbackDescription") : introduction.description}</p>
      </div>

      <div className="intro-grid">
        {introCapabilities.map((item) => (
          <article key={item.id} className="intro-card">
            <h3>{capabilityFallbackMap[item.id]?.title || item.title}</h3>
            <p>{capabilityFallbackMap[item.id]?.description || item.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
