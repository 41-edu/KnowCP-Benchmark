import { Link } from "react-router-dom";

export function PanoramaEntrySection() {
  return (
    <section className="section-block" id="panorama-entry">
      <div className="section-head">
        <h2>Panorama Navigation</h2>
        <p>Both Object Panorama and Technique Panorama use the same interaction logic.</p>
      </div>
      <div className="entry-grid">
        <Link to="/panorama/object" className="entry-card object">
          <h3>Object Panorama</h3>
          <p>Browse top-level object categories and drill down to detailed image evidence.</p>
        </Link>
        <Link to="/panorama/technique" className="entry-card technique">
          <h3>Technique Panorama</h3>
          <p>Explore painting techniques through the same multi-level visual pipeline.</p>
        </Link>
      </div>
    </section>
  );
}
