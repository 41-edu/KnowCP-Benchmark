import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FocusedImageCard } from "../components/FocusedImageCard";
import { ImageLightbox } from "../components/ImageLightbox";
import { panoramaByDomain } from "../data/panorama";
import type { DomainType, PanoramaImage, PanoramaNode } from "../types";
import { findNodeById, firstImageOfNode } from "../utils/panorama";

function domainLabel(domain: DomainType) {
  return domain === "object" ? "Object" : "Technique";
}

function asDomain(value: string | undefined): DomainType {
  return value === "technique" ? "technique" : "object";
}

function SubCategoryCards({
  topNode,
  domain,
}: {
  topNode: PanoramaNode;
  domain: DomainType;
}) {
  const children = topNode.children ?? [];

  return (
    <div className="category-grid">
      {children.map((child) => {
        const cover = firstImageOfNode(child);
        return (
          <Link
            key={child.id}
            to={`/panorama/${domain}/${topNode.id}/${child.id}`}
            className="category-card"
            style={
              cover
                ? {
                    backgroundImage: `linear-gradient(180deg, rgba(6,22,17,0.05), rgba(6,22,17,0.7)), url(${cover})`,
                  }
                : undefined
            }
          >
            <h3>{child.name}</h3>
          </Link>
        );
      })}
    </div>
  );
}

export function PanoramaExplorerPage() {
  const params = useParams();
  const domain = asDomain(params.domain);
  const topId = params.topId;
  const secondId = params.secondId;
  const thirdId = params.thirdId;

  const roots = panoramaByDomain[domain];
  const topNode = findNodeById(roots, topId);
  const secondNode = findNodeById(roots, secondId);
  const thirdNode = findNodeById(roots, thirdId);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const pageTitle = useMemo(() => {
    if (!topId) {
      return `${domainLabel(domain)} Panorama`;
    }
    if (!secondId) {
      return `${domainLabel(domain)} Panorama - ${topNode?.name ?? "Category"}`;
    }
    if (!thirdId) {
      return `${domainLabel(domain)} Panorama - ${secondNode?.name ?? "Details"}`;
    }
    return `${domainLabel(domain)} Panorama - ${thirdNode?.name ?? "Subcategory"}`;
  }, [domain, secondId, thirdId, topId, topNode?.name, secondNode?.name, thirdNode?.name]);

  const currentImages: PanoramaImage[] = thirdNode?.images ?? secondNode?.images ?? [];
  const thirdLevelNodes = secondNode?.children ?? [];

  return (
    <main className="page-wrap">
      <section className="section-block panorama-head">
        <div className="section-head">
          <h2>{pageTitle}</h2>
          <p>Click cards to navigate taxonomy levels. Click images to open a larger view.</p>
        </div>
        <div className="breadcrumb-row">
          <Link to="/">Home</Link>
          <span>/</span>
          <Link to={`/panorama/${domain}`}>{domainLabel(domain)} Panorama</Link>
          {topId && topNode && (
            <>
              <span>/</span>
              <Link to={`/panorama/${domain}/${topNode.id}`}>{topNode.name}</Link>
            </>
          )}
          {secondId && secondNode && (
            <>
              <span>/</span>
              <Link to={`/panorama/${domain}/${topNode?.id}/${secondNode.id}`}>{secondNode.name}</Link>
            </>
          )}
          {thirdId && thirdNode && (
            <>
              <span>/</span>
              <span>{thirdNode.name}</span>
            </>
          )}
        </div>
      </section>

      {!topId && (
        <section className="section-block">
          <div className="category-grid">
            {roots.map((root) => (
              <Link
                key={root.id}
                to={`/panorama/${domain}/${root.id}`}
                className="category-card"
                style={
                  firstImageOfNode(root)
                    ? {
                        backgroundImage: `linear-gradient(180deg, rgba(6,22,17,0.05), rgba(6,22,17,0.7)), url(${firstImageOfNode(root)})`,
                      }
                    : undefined
                }
              >
                <h3>{root.name}</h3>
              </Link>
            ))}
          </div>
        </section>
      )}

      {topNode && !secondId && (
        <section className="section-block">
          <div className="section-head">
            <h3>Second-Level Categories</h3>
          </div>
          <SubCategoryCards topNode={topNode} domain={domain} />
        </section>
      )}

      {secondNode && (
        <section className="section-block">
          {thirdLevelNodes.length > 0 && (
            <>
              <div className="section-head">
                <h3>Third-Level Categories</h3>
                <p>Only shown when this second-level category has third-level children.</p>
              </div>
              <div className="chip-panel">
                {thirdLevelNodes.map((node) => (
                  <Link
                    key={node.id}
                    to={`/panorama/${domain}/${topNode?.id}/${secondNode.id}/${node.id}`}
                    className={`chip-link ${thirdId === node.id ? "active" : ""}`}
                  >
                    {node.name}
                  </Link>
                ))}
              </div>
            </>
          )}

          <div className="section-head">
            <h3>Image Gallery</h3>
            <p>Bounding boxes are highlighted while outside areas are blurred.</p>
          </div>
          <div className="focus-grid">
            {currentImages.map((image, index) => (
              <FocusedImageCard
                key={image.id}
                image={image}
                onClick={() => {
                  setLightboxIndex(index);
                }}
              />
            ))}
          </div>
          {currentImages.length === 0 && (
            <p className="empty-hint">No images in this node yet. Add data in panorama.ts.</p>
          )}
        </section>
      )}

      {lightboxIndex !== null && (
        <ImageLightbox
          images={currentImages}
          selectedIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() =>
            setLightboxIndex((index) => {
              if (index === null) {
                return 0;
              }
              return (index - 1 + currentImages.length) % currentImages.length;
            })
          }
          onNext={() =>
            setLightboxIndex((index) => {
              if (index === null) {
                return 0;
              }
              return (index + 1) % currentImages.length;
            })
          }
        />
      )}
    </main>
  );
}
