import ReactECharts from "echarts-for-react";
import { questionDistributions, questionExamples } from "../data/questions";

export function QuestionDistributionSection() {
  return (
    <section className="section-block" id="question-distribution">
      <div className="section-head">
        <h2>Question Type Distribution</h2>
        <p>Each question type includes a placeholder chart and one placeholder example.</p>
      </div>

      <div className="question-grid">
        {questionDistributions.map((item) => {
          const option = {
            tooltip: { trigger: "axis" },
            xAxis: {
              type: "category",
              data: item.labels,
            },
            yAxis: {
              type: "value",
            },
            series: [
              {
                type: "bar",
                data: item.values,
                itemStyle: {
                  color: "#2f5d50",
                  borderRadius: [6, 6, 0, 0],
                },
              },
            ],
            grid: { left: 35, right: 20, top: 30, bottom: 35 },
          };

          const example = questionExamples.find(
            (exampleItem) => exampleItem.questionType === item.questionType,
          );

          return (
            <article key={item.questionType} className="question-card">
              <h3>{item.questionType}</h3>
              <ReactECharts option={option} style={{ height: 260 }} />
              {example && (
                <div className="question-example">
                  <p>
                    <strong>Question:</strong> {example.question}
                  </p>
                  <p>
                    <strong>Answer:</strong> {example.answer}
                  </p>
                  <p>
                    <strong>Note:</strong> {example.note}
                  </p>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
