import type { DomainType, PanoramaNode } from "../types";

const sampleImages = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-img-${index + 1}`,
    title: `${prefix.toUpperCase()} Sample ${index + 1}`,
    imageUrl: `https://picsum.photos/seed/${prefix}-${index + 1}/1200/900`,
    bbox: {
      x: 0.2 + (index % 3) * 0.1,
      y: 0.18 + (index % 2) * 0.08,
      width: 0.28,
      height: 0.36,
    },
  }));

export const objectPanorama: PanoramaNode[] = [
  {
    id: "obj-figures",
    name: "Figures",
    level: 1,
    children: [
      {
        id: "obj-figures-scholars",
        name: "Scholars",
        level: 2,
        coverImage: "https://picsum.photos/seed/scholars-cover/900/600",
        children: [
          {
            id: "obj-figures-scholars-reading",
            name: "Reading",
            level: 3,
            images: sampleImages("reading", 4),
          },
          {
            id: "obj-figures-scholars-walking",
            name: "Walking",
            level: 3,
            images: sampleImages("walking", 3),
          },
        ],
        images: sampleImages("scholars", 6),
      },
      {
        id: "obj-figures-monks",
        name: "Monks",
        level: 2,
        coverImage: "https://picsum.photos/seed/monks-cover/900/600",
        images: sampleImages("monks", 5),
      },
    ],
  },
  {
    id: "obj-landscape",
    name: "Landscape",
    level: 1,
    children: [
      {
        id: "obj-landscape-mountains",
        name: "Mountains",
        level: 2,
        coverImage: "https://picsum.photos/seed/mountains-cover/900/600",
        children: [
          {
            id: "obj-landscape-mountains-cliff",
            name: "Cliff",
            level: 3,
            images: sampleImages("cliff", 4),
          },
          {
            id: "obj-landscape-mountains-ridge",
            name: "Ridge",
            level: 3,
            images: sampleImages("ridge", 4),
          },
        ],
        images: sampleImages("mountains", 7),
      },
      {
        id: "obj-landscape-water",
        name: "Water",
        level: 2,
        coverImage: "https://picsum.photos/seed/water-cover/900/600",
        images: sampleImages("water", 6),
      },
    ],
  },
  {
    id: "obj-plants",
    name: "Plants",
    level: 1,
    children: [
      {
        id: "obj-plants-bamboo",
        name: "Bamboo",
        level: 2,
        coverImage: "https://picsum.photos/seed/bamboo-cover/900/600",
        images: sampleImages("bamboo", 5),
      },
      {
        id: "obj-plants-plum",
        name: "Plum Blossom",
        level: 2,
        coverImage: "https://picsum.photos/seed/plum-cover/900/600",
        images: sampleImages("plum", 5),
      },
    ],
  },
];

export const techniquePanorama: PanoramaNode[] = [
  {
    id: "tec-stroke",
    name: "Brushstroke",
    level: 1,
    children: [
      {
        id: "tec-stroke-center-tip",
        name: "Center-tip Stroke",
        level: 2,
        coverImage: "https://picsum.photos/seed/center-tip-cover/900/600",
        children: [
          {
            id: "tec-stroke-center-tip-long",
            name: "Long Stroke",
            level: 3,
            images: sampleImages("long-stroke", 4),
          },
          {
            id: "tec-stroke-center-tip-short",
            name: "Short Stroke",
            level: 3,
            images: sampleImages("short-stroke", 4),
          },
        ],
        images: sampleImages("center-tip", 6),
      },
      {
        id: "tec-stroke-side-tip",
        name: "Side-tip Stroke",
        level: 2,
        coverImage: "https://picsum.photos/seed/side-tip-cover/900/600",
        images: sampleImages("side-tip", 6),
      },
    ],
  },
  {
    id: "tec-texture",
    name: "Texture Method",
    level: 1,
    children: [
      {
        id: "tec-texture-axe-cut",
        name: "Axe-cut Texture",
        level: 2,
        coverImage: "https://picsum.photos/seed/axe-cut-cover/900/600",
        images: sampleImages("axe-cut", 6),
      },
      {
        id: "tec-texture-hemp-fiber",
        name: "Hemp-fiber Texture",
        level: 2,
        coverImage: "https://picsum.photos/seed/hemp-fiber-cover/900/600",
        images: sampleImages("hemp-fiber", 6),
      },
    ],
  },
];

export const panoramaByDomain: Record<DomainType, PanoramaNode[]> = {
  object: objectPanorama,
  technique: techniquePanorama,
};
