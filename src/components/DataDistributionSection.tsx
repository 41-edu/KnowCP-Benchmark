import { datasetTotals, museumDistribution } from "../data/distribution";

export function DataDistributionSection() {
  return (
    <section className="section-block" id="distribution">
      <div className="section-head">
        <h2>Data Distribution</h2>
        <p>Placeholder numbers are shown below and can be replaced from data files.</p>
      </div>

      <div className="table-card">
        <h3>Museum Collection Distribution</h3>
        <table>
          <thead>
            <tr>
              <th>Museum</th>
              <th>Paintings</th>
            </tr>
          </thead>
          <tbody>
            {museumDistribution.map((record) => (
              <tr key={record.museum}>
                <td>{record.museum}</td>
                <td>{record.paintings.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-card">
        <h3>Dataset Totals</h3>
        <table>
          <thead>
            <tr>
              <th>Total Paintings</th>
              <th>Seal Annotations</th>
              <th>Colophon Annotations</th>
              <th>Object Annotations</th>
              <th>Technique Annotations</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{datasetTotals.totalPaintings.toLocaleString()}</td>
              <td>{datasetTotals.sealAnnotations.toLocaleString()}</td>
              <td>{datasetTotals.colophonAnnotations.toLocaleString()}</td>
              <td>{datasetTotals.objectAnnotations.toLocaleString()}</td>
              <td>{datasetTotals.techniqueAnnotations.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
