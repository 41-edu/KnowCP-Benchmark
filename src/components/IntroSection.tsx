import { useJsonContent } from "../hooks/useJsonContent";

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
  const introCapabilities = useJsonContent<IntroCapability[]>(
    "/content/intro-capabilities.json",
    fallbackIntro,
  );
  const introduction = useJsonContent<{ description: string }>("/content/introduction.json", {
    description:
      "KnowCP evaluates visual perception, question answering, and cultural reasoning for Chinese painting understanding.",
  });

  return (
    <section className="section-block" id="intro">
      <div className="section-head center-head">
        <h2>Introduction</h2>
        <p>{introduction.description}</p>
      </div>

      <div className="intro-grid">
        {introCapabilities.map((item) => (
          <article key={item.id} className="intro-card">
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
