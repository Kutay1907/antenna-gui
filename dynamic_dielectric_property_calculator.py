from bisect import bisect_left
import math

from flask import Flask, render_template_string, request


EPS0 = 8.854187817e-12  # Vacuum permittivity (F/m)
OMEGA_FACTOR = 2 * math.pi * 1e9  # Multiply GHz to get angular frequency
ANCHOR_F = (0.5, 2.5, 5.0, 10.0)  # GHz calibration anchors


def _bp_model(glu_mgdl: float, f_ghz: float, tau_scale: float = 1e-12):
    chi = glu_mgdl / 18.0  # mg/dL -> mmol/L
    w = 2 * math.pi * f_ghz * 1e9
    eps_inf = 0.0099 * chi ** 2 + 0.047 * chi + 2.3
    delta = 0.0093 * chi ** 2 - 0.21 * chi + 71.0
    tau = (0.0012 * chi ** 2 + 0.23 * chi + 8.7) * tau_scale
    sig_i = 0.0063 * chi ** 2 - 0.14 * chi + 2.0
    eps_hat = eps_inf + delta / (1 + 1j * w * tau)  # Cole–Cole (α≈0)
    er = eps_hat.real
    sigma = sig_i + w * EPS0 * (-eps_hat.imag)
    return er, sigma


def _dw_model(glu_mgdl: float, f_ghz: float, tau_scale: float = 1e-12):
    chi = glu_mgdl / 18.0
    w = 2 * math.pi * f_ghz * 1e9
    eps_inf = -8.214e-8 * chi ** 2 + 2.148e-3 * chi + 8.722
    eps_s = 2.318e-9 * chi ** 2 - 2.793e-4 * chi + 81.015
    tau = (-8.370e-9 * chi ** 2 + 5.150e-4 * chi + 8.776) * tau_scale
    eps_hat = eps_inf + (eps_s - eps_inf) / (1 + 1j * w * tau)
    er = eps_hat.real
    sigma = w * EPS0 * (-eps_hat.imag)
    return er, sigma


def compute_loss_tangent(epsilon_r: float, sigma: float, frequency_ghz: float) -> float:
    if frequency_ghz <= 0 or epsilon_r == 0:
        return float("nan")
    omega = OMEGA_FACTOR * frequency_ghz
    return sigma / (omega * EPS0 * epsilon_r)


_BP_TABLE_ER = {
    0.5: {72: 72.75, 219: 72.73, 330: 72.71, 600: 72.66},
    2.5: {72: 69.74, 219: 69.70, 330: 69.67, 600: 69.59},
    5.0: {72: 64.62, 219: 64.56, 330: 64.51, 600: 64.39},
    10.0: {72: 53.24, 219: 53.14, 330: 53.07, 600: 52.88},
}

_BP_TABLE_SIGMA = {
    0.5: {72: 2.065, 219: 2.046, 330: 2.030, 600: 1.995},
    2.5: {72: 3.498, 219: 3.482, 330: 3.470, 600: 3.441},
    5.0: {72: 7.078, 219: 7.069, 330: 7.062, 600: 7.046},
    10.0: {72: 16.91, 219: 16.91, 330: 16.91, 600: 16.90},
}

_DW_TABLE_ER = {
    0.5: {72: 80.94, 219: 80.90, 330: 80.87, 600: 80.79},
    2.5: {72: 79.64, 219: 79.58, 330: 79.54, 600: 79.43},
    5.0: {72: 75.86, 219: 75.76, 330: 75.69, 600: 75.51},
    10.0: {72: 64.07, 219: 63.90, 330: 63.76, 600: 63.44},
}

_DW_TABLE_SIGMA = {
    0.5: {72: 5.55e-2, 219: 5.57e-2, 330: 5.58e-2, 600: 5.62e-2},
    2.5: {72: 13.62e-1, 219: 13.67e-1, 330: 13.70e-1, 600: 13.78e-1},
    5.0: {72: 51.59e-1, 219: 51.71e-1, 330: 51.80e-1, 600: 52.01e-1},
    10.0: {72: 17.00, 219: 17.00, 330: 16.99, 600: 16.97},
}


def _build_correction_table(table_er, table_sigma, model_fn):
    corrections = {}
    for freq, er_targets in table_er.items():
        sigma_targets = table_sigma[freq]
        er_corr = {}
        sigma_corr = {}
        for glucose, er_target in er_targets.items():
            chi = glucose / 18.0
            er_model, sigma_model = model_fn(glucose, freq)
            er_corr[chi] = er_target - er_model
            sigma_corr[chi] = sigma_targets[glucose] - sigma_model
        corrections[freq] = {"er": er_corr, "sigma": sigma_corr}
    return corrections


def _lagrange_interpolate(x, points: dict):
    items = list(points.items())
    total = 0.0
    for i, (xi, yi) in enumerate(items):
        term = yi
        for j, (xj, _) in enumerate(items):
            if i == j:
                continue
            term *= (x - xj) / (xi - xj)
        total += term
    return total


def _evaluate_correction(freq, chi, correction_table, key):
    freqs = sorted(correction_table.keys())
    if freq <= freqs[0]:
        return _lagrange_interpolate(chi, correction_table[freqs[0]][key])
    if freq >= freqs[-1]:
        return _lagrange_interpolate(chi, correction_table[freqs[-1]][key])
    if freq in correction_table:
        return _lagrange_interpolate(chi, correction_table[freq][key])
    idx = bisect_left(freqs, freq)
    f0, f1 = freqs[idx - 1], freqs[idx]
    t = (freq - f0) / (f1 - f0)
    c0 = _lagrange_interpolate(chi, correction_table[f0][key])
    c1 = _lagrange_interpolate(chi, correction_table[f1][key])
    return c0 + t * (c1 - c0)


_BP_CORR = _build_correction_table(_BP_TABLE_ER, _BP_TABLE_SIGMA, _bp_model)
_DW_CORR = _build_correction_table(_DW_TABLE_ER, _DW_TABLE_SIGMA, _dw_model)


def dielectric_BP(glucose_mgdl: float, freq_ghz: float):
    er_model, sig_model = _bp_model(glucose_mgdl, freq_ghz)
    chi = glucose_mgdl / 18.0
    er_correction = _evaluate_correction(freq_ghz, chi, _BP_CORR, "er")
    sigma_correction = _evaluate_correction(freq_ghz, chi, _BP_CORR, "sigma")
    er = er_model + er_correction
    sigma = sig_model + sigma_correction
    return float(er), float(sigma)


def dielectric_DW(glucose_mgdl: float, freq_ghz: float):
    er_model, sig_model = _dw_model(glucose_mgdl, freq_ghz)
    chi = glucose_mgdl / 18.0
    er_correction = _evaluate_correction(freq_ghz, chi, _DW_CORR, "er")
    sigma_correction = _evaluate_correction(freq_ghz, chi, _DW_CORR, "sigma")
    er = er_model + er_correction
    sigma = sig_model + sigma_correction
    return float(er), float(sigma)

def _build_chart_datasets(glucose_entries, freq_points, calculator):
    datasets = []
    for entry in glucose_entries:
        glucose = entry["glucose"]
        permittivity_values = []
        conductivity_values = []
        for freq in freq_points:
            er, sigma = calculator(glucose, freq)
            permittivity_values.append(er)
            conductivity_values.append(sigma)
        datasets.append(
            {
                "label": entry["label"],
                "permittivity": permittivity_values,
                "conductivity": conductivity_values,
                "isUser": entry.get("is_user", False),
            }
        )
    return datasets


HTML_TEMPLATE = """
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Dynamic Dielectric Property Calculator</title>
  <style>
    body { font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 40px; color: #2b3a42; }
    .container { max-width: 960px; margin: auto; background: #fff; padding: 28px 36px 36px; border-radius: 14px; box-shadow: 0 10px 28px rgba(15,35,58,0.12); }
    h1 { font-size: 2rem; margin-bottom: 1.2rem; text-align: center; color: #1a2a34; }
    label { font-weight: 600; display: block; margin-bottom: 6px; color: #2b3a42; }
    input { width: 100%; padding: 10px 12px; margin-bottom: 16px; border: 1px solid #ccd5db; border-radius: 6px; font-size: 1rem; background-color: #fdfdfd; }
    button { background-color: #1e88e5; border: none; color: white; padding: 12px 18px; border-radius: 6px; font-size: 1rem; cursor: pointer; width: 100%; transition: background-color 0.2s ease; }
    button:hover { background-color: #1669bb; }
    .error { background-color: #fdecea; color: #b22b27; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px; border-left: 4px solid #d93025; }
    .result { background-color: #eef8f2; color: #1d5d3c; padding: 16px 18px; border-radius: 6px; margin-top: 20px; line-height: 1.6; border-left: 4px solid #2e7d32; }
    .result strong { display: block; font-size: 1.15rem; margin-bottom: 8px; }
    .chart-section { margin-top: 28px; }
    .chart-section h2 { font-size: 1.4rem; margin-bottom: 12px; color: #1a2a34; }
    .chart-grid { display: grid; gap: 18px; }
    @media (min-width: 720px) {
      .chart-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    .chart-card { background: #ffffff; border-radius: 12px; padding: 18px 18px 24px; box-shadow: 0 6px 18px rgba(0,0,0,0.08); border: 1px solid rgba(14,31,53,0.06); }
    .chart-card h3 { font-size: 1.05rem; margin-bottom: 12px; text-align: center; color: #2b3a42; }
    canvas { width: 100% !important; height: 280px !important; }
    .footer { margin-top: 28px; font-size: 0.85rem; color: #5f6c74; text-align: center; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head>
<body>
  <div class="container">
    <h1>Dynamic Dielectric Property Calculator</h1>
    {% if errors %}
      <div class="error">
        {% for error in errors %}
          <div>{{ error }}</div>
        {% endfor %}
      </div>
    {% endif %}
    <form method="post">
      <label for="glucose">Glucose concentration (mg/dL)</label>
      <input type="number" step="any" id="glucose" name="glucose" value="{{ glucose_value }}" required>

      <label for="frequency">Frequency (GHz)</label>
      <input type="number" step="any" min="0" id="frequency" name="frequency" value="{{ frequency_value }}" required>

      <button type="submit">Compute</button>
    </form>

    {% if result %}
      <div class="result">
        <strong>Computed at {{ frequency_value }} GHz</strong>
        <div><em>Blood Plasma (Cole–Cole)</em>: ε<sub>r</sub> = {{ result.bp_eps_r }} | σ = {{ result.bp_sigma }} S/m | tan&#948; = {{ result.bp_loss }}</div>
        <div><em>De-ionized Water (Debye)</em>: ε<sub>r</sub> = {{ result.dw_eps_r }} | σ = {{ result.dw_sigma }} S/m | tan&#948; = {{ result.dw_loss }}</div>
      </div>
      <div class="chart-section">
        <h2>Blood Plasma (Cole–Cole) Trends</h2>
        <div class="chart-grid">
          <div class="chart-card">
            <h3>Relative Permittivity vs Frequency</h3>
            <canvas id="bpPermChart"></canvas>
          </div>
          <div class="chart-card">
            <h3>Conductivity vs Frequency</h3>
            <canvas id="bpCondChart"></canvas>
          </div>
        </div>
      </div>
      <div class="chart-section">
        <h2>De-ionized Water (Debye) Trends</h2>
        <div class="chart-grid">
          <div class="chart-card">
            <h3>Relative Permittivity vs Frequency</h3>
            <canvas id="dwPermChart"></canvas>
          </div>
          <div class="chart-card">
            <h3>Conductivity vs Frequency</h3>
            <canvas id="dwCondChart"></canvas>
          </div>
        </div>
      </div>
    {% endif %}

    <div class="footer">Enter glucose and frequency to compute dielectric properties.</div>
  </div>
  {% if chart_curves %}
  <script>
    const curveData = {{ chart_curves | tojson }};
    const freqLabels = curveData.frequency.map(f => f.toFixed(2));
    const baseColors = ['#1565c0', '#00897b', '#ef6c00', '#6a1b9a', '#00838f', '#7b1fa2'];
    const userColor = '#d81b60';

    function buildDatasets(datasets, valueKey) {
      let colorIndex = 0;
      return datasets.map(set => {
        const isUser = Boolean(set.isUser);
        const color = isUser ? userColor : baseColors[colorIndex++ % baseColors.length];
        return {
          label: set.label,
          data: set[valueKey],
          borderColor: color,
          borderWidth: isUser ? 3 : 2,
          borderDash: isUser ? [] : [0],
          fill: false,
          tension: 0.18,
          pointRadius: isUser ? 3 : 1,
          pointHoverRadius: isUser ? 5 : 3,
          pointBackgroundColor: color,
          spanGaps: false,
        };
      });
    }

    function createLineChart(canvasId, datasets, valueKey, yAxisLabel) {
      const ctx = document.getElementById(canvasId).getContext('2d');
      return new Chart(ctx, {
        type: 'line',
        data: {
          labels: freqLabels,
          datasets: buildDatasets(datasets, valueKey),
        },
        options: {
          responsive: true,
          interaction: { mode: 'nearest', intersect: false },
          plugins: {
            legend: {
              labels: {
                usePointStyle: true,
                boxWidth: 8,
              }
            },
            tooltip: {
              callbacks: {
                title: (tooltipItems) => `Frequency: ${tooltipItems[0].label} GHz`,
                label: (context) => `${context.dataset.label}: ${context.parsed.y.toFixed(3)}`
              }
            }
          },
          scales: {
            x: {
              title: { display: true, text: 'Frequency (GHz)' },
              ticks: { maxTicksLimit: 10 }
            },
            y: {
              title: { display: true, text: yAxisLabel },
              ticks: { maxTicksLimit: 8 }
            }
          }
        }
      });
    }

    createLineChart('bpPermChart', curveData.bp.datasets, 'permittivity', 'εr');
    createLineChart('bpCondChart', curveData.bp.datasets, 'conductivity', 'σ (S/m)');
    createLineChart('dwPermChart', curveData.dw.datasets, 'permittivity', 'εr');
    createLineChart('dwCondChart', curveData.dw.datasets, 'conductivity', 'σ (S/m)');
  </script>
  {% endif %}
</body>
</html>
"""


def create_app() -> Flask:
    app = Flask(__name__)

    @app.route("/", methods=["GET", "POST"])
    def index():
        errors = []
        result = None
        chart_curves = None
        glucose_raw = request.form.get("glucose", "")
        frequency_raw = request.form.get("frequency", "")

        if request.method == "POST":
            glucose = None
            frequency = None
            try:
                glucose = float(glucose_raw)
            except ValueError:
                errors.append("Glucose concentration must be a number.")
            else:
                if glucose < 0:
                    errors.append("Glucose concentration must be zero or positive.")

            try:
                frequency = float(frequency_raw)
            except ValueError:
                errors.append("Frequency must be a number.")
            else:
                if frequency < 0:
                    errors.append("Frequency must be zero or positive.")

            if not errors and glucose is not None and frequency is not None:
                bp_eps_r, bp_sigma = dielectric_BP(glucose, frequency)
                dw_eps_r, dw_sigma = dielectric_DW(glucose, frequency)
                bp_loss = compute_loss_tangent(bp_eps_r, bp_sigma, frequency)
                dw_loss = compute_loss_tangent(dw_eps_r, dw_sigma, frequency)
                result = {
                    "bp_eps_r": f"{bp_eps_r:.6g}",
                    "bp_sigma": f"{bp_sigma:.6g}",
                    "bp_loss": "N/A" if math.isnan(bp_loss) else f"{bp_loss:.6g}",
                    "dw_eps_r": f"{dw_eps_r:.6g}",
                    "dw_sigma": f"{dw_sigma:.6g}",
                    "dw_loss": "N/A" if math.isnan(dw_loss) else f"{dw_loss:.6g}",
                    "bp_eps_r_val": bp_eps_r,
                    "bp_sigma_val": bp_sigma,
                    "bp_loss_val": bp_loss,
                    "dw_eps_r_val": dw_eps_r,
                    "dw_sigma_val": dw_sigma,
                    "dw_loss_val": dw_loss,
                }
                reference_glucose = [72.0, 216.0, 330.0, 600.0]
                freq_points = [round(0.5 + 0.5 * i, 2) for i in range(20)]
                entries = [{"glucose": g, "label": f"{g:.0f} mg/dL"} for g in reference_glucose]
                matched_entry = None
                for entry in entries:
                    if abs(entry["glucose"] - glucose) < 1e-6:
                        entry["is_user"] = True
                        entry["label"] = f"{entry['glucose']:.0f} mg/dL (input)"
                        matched_entry = entry
                        break
                if matched_entry is None:
                    entries.append(
                        {
                            "glucose": glucose,
                            "label": f"Input {glucose:.2f} mg/dL",
                            "is_user": True,
                        }
                    )
                chart_curves = {
                    "frequency": freq_points,
                    "bp": {
                        "datasets": _build_chart_datasets(entries, freq_points, dielectric_BP),
                    },
                    "dw": {
                        "datasets": _build_chart_datasets(entries, freq_points, dielectric_DW),
                    },
                }

        context = {
            "errors": errors,
            "result": result,
            "glucose_value": glucose_raw,
            "frequency_value": frequency_raw,
            "chart_curves": chart_curves,
        }
        return render_template_string(HTML_TEMPLATE, **context)

    return app


app = create_app()


def main():
    app.run(host="127.0.0.1", port=5000, debug=False)


if __name__ == "__main__":
    main()
