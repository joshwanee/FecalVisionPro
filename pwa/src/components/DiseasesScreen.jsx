import { useEffect, useRef } from 'react';
import { COMPARISON, DISEASES, HEALTHY } from '../content/diseases';

/**
 * Disease guide: what each disease the app screens for looks like, in the
 * droppings and in the bird. One section per disease that opens on tap
 * (progressive disclosure, like Help), then a side-by-side comparison.
 */
export default function DiseasesScreen() {
  const titleRef = useRef(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <div className="screen">
      <h1 ref={titleRef} tabIndex={-1}>
        Disease guide
      </h1>
      <p className="lead">
        The three diseases FecalVision screens for, and what healthy droppings look like. Only a
        veterinarian can confirm a disease.
      </p>

      <div className="accordion">
        {DISEASES.map((d, i) => (
          <details key={d.id} open={i === 0}>
            <summary>
              {i + 1}. {d.name}
            </summary>
            <p>{d.definition}</p>
            {d.forms && (
              <ul>
                {d.forms.map((f) => (
                  <li key={f.name}>
                    <strong>{f.name}</strong>: {f.text}
                  </li>
                ))}
              </ul>
            )}
            <dl className="disease">
              <div className="disease__droppings">
                <dt>Droppings</dt>
                <dd>{d.droppings}</dd>
              </div>
              <div>
                <dt>General signs</dt>
                <dd>{d.signs}</dd>
              </div>
              <div>
                <dt>How it spreads</dt>
                <dd>{d.transmission}</dd>
              </div>
              <div>
                <dt>How to tell it apart</dt>
                <dd>{d.differentiator}</dd>
              </div>
            </dl>
          </details>
        ))}

        <details>
          <summary>{DISEASES.length + 1}. {HEALTHY.name}</summary>
          {HEALTHY.text.map((t) => (
            <p key={t}>{t}</p>
          ))}
        </details>
      </div>

      <section className="compare" aria-labelledby="compare-title">
        <h2 id="compare-title">Quick comparison</h2>
        <div className="compare__scroll" tabIndex={0} role="region" aria-labelledby="compare-title">
          <table>
            <thead>
              <tr>
                {COMPARISON.columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON.rows.map(([name, ...cells]) => (
                <tr key={name}>
                  <th scope="row">{name}</th>
                  {cells.map((c, j) => (
                    <td key={j}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
