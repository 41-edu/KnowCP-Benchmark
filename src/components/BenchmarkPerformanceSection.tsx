import { benchmarkRecords } from "../data/benchmark";

export function BenchmarkPerformanceSection() {
  return (
    <section className="section-block" id="benchmark-performance">
      <div className="section-head">
        <h2>Benchmark Performance</h2>
        <p>Replace this placeholder table with your final evaluation results.</p>
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Model</th>
              <th>Object</th>
              <th>Technique</th>
              <th>Seal</th>
              <th>Colophon</th>
              <th>Overall</th>
            </tr>
          </thead>
          <tbody>
            {benchmarkRecords.map((record) => (
              <tr key={record.model}>
                <td>{record.model}</td>
                <td>{record.object.toFixed(1)}</td>
                <td>{record.technique.toFixed(1)}</td>
                <td>{record.seal.toFixed(1)}</td>
                <td>{record.colophon.toFixed(1)}</td>
                <td>{record.overall.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
