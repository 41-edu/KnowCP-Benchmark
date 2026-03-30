import type { QuestionDistribution, QuestionExample } from "../types";

export const questionDistributions: QuestionDistribution[] = [
  {
    questionType: "Object Recognition",
    labels: ["Easy", "Medium", "Hard"],
    values: [240, 188, 122],
  },
  {
    questionType: "Technique Identification",
    labels: ["Easy", "Medium", "Hard"],
    values: [201, 165, 149],
  },
  {
    questionType: "Seal Understanding",
    labels: ["Easy", "Medium", "Hard"],
    values: [142, 116, 95],
  },
  {
    questionType: "Colophon Reasoning",
    labels: ["Easy", "Medium", "Hard"],
    values: [98, 132, 121],
  },
];

export const questionExamples: QuestionExample[] = [
  {
    questionType: "Object Recognition",
    question: "What object appears in the highlighted region of this painting?",
    answer: "Bamboo leaves",
    note: "Placeholder example. Replace with your final benchmark item.",
  },
  {
    questionType: "Technique Identification",
    question: "Which brushwork technique is dominant in the mountain texture?",
    answer: "Axe-cut texture strokes",
    note: "Placeholder example. Replace with your final benchmark item.",
  },
  {
    questionType: "Seal Understanding",
    question: "Which era does this seal style most likely belong to?",
    answer: "Early Qing period",
    note: "Placeholder example. Replace with your final benchmark item.",
  },
  {
    questionType: "Colophon Reasoning",
    question: "What is the main historical event referenced in this colophon?",
    answer: "A reconstruction after relocation",
    note: "Placeholder example. Replace with your final benchmark item.",
  },
];
