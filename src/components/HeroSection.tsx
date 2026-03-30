import { siteMeta } from "../data/siteContent";

export function HeroSection() {
  return (
    <section className="hero-section" id="top">
      <div className="hero-content">
        <p className="eyebrow">Dataset Release</p>
        <h1>{siteMeta.title}</h1>
        <p className="hero-subtitle">{siteMeta.subtitle}</p>
        <div className="hero-links">
          <a href={siteMeta.githubUrl} target="_blank" rel="noreferrer">
            Project on GitHub
          </a>
          <a href={siteMeta.huggingFaceUrl} target="_blank" rel="noreferrer">
            Dataset on Hugging Face
          </a>
        </div>
      </div>
      <div className="hero-cover-wrapper">
        <img src={siteMeta.coverImage} alt="KnowCP cover" className="hero-cover" />
      </div>
    </section>
  );
}
