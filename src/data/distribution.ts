import type { DatasetTotals, MuseumRecord } from "../types";

export const museumDistribution: MuseumRecord[] = [
  { museum: "National Palace Museum", paintings: 182 },
  { museum: "The Palace Museum", paintings: 167 },
  { museum: "Shanghai Museum", paintings: 143 },
  { museum: "Liaoning Provincial Museum", paintings: 96 },
  { museum: "Nanjing Museum", paintings: 74 },
];

export const datasetTotals: DatasetTotals = {
  totalPaintings: 1284,
  sealAnnotations: 15422,
  colophonAnnotations: 4820,
  objectAnnotations: 31876,
  techniqueAnnotations: 9042,
};
