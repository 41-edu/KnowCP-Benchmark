import type { BenchmarkRecord } from "../types";

export const benchmarkRecords: BenchmarkRecord[] = [
  {
    model: "GPT-4.1",
    object: 68.4,
    technique: 61.2,
    seal: 57.1,
    colophon: 55.9,
    overall: 60.7,
  },
  {
    model: "Qwen2.5-VL-72B",
    object: 65.9,
    technique: 59.8,
    seal: 54.3,
    colophon: 52.6,
    overall: 58.2,
  },
  {
    model: "InternVL2.5-78B",
    object: 63.3,
    technique: 58.1,
    seal: 53.6,
    colophon: 50.8,
    overall: 56.5,
  },
  {
    model: "LLaVA-OneVision-72B",
    object: 60.2,
    technique: 55.7,
    seal: 49.2,
    colophon: 47.5,
    overall: 53.1,
  },
];
