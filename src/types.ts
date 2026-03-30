export type DomainType = "object" | "technique";

export interface MuseumRecord {
  museum: string;
  paintings: number;
}

export interface DatasetTotals {
  totalPaintings: number;
  sealAnnotations: number;
  colophonAnnotations: number;
  objectAnnotations: number;
  techniqueAnnotations: number;
}

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PanoramaImage {
  id: string;
  title: string;
  imageUrl: string;
  bbox: BBox;
}

export interface PanoramaNode {
  id: string;
  name: string;
  level: 1 | 2 | 3;
  coverImage?: string;
  images?: PanoramaImage[];
  children?: PanoramaNode[];
}

export interface QuestionDistribution {
  questionType: string;
  labels: string[];
  values: number[];
}

export interface QuestionExample {
  questionType: string;
  question: string;
  answer: string;
  note: string;
}

export interface BenchmarkRecord {
  model: string;
  object: number;
  technique: number;
  seal: number;
  colophon: number;
  overall: number;
}
