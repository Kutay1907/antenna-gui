from bisect import bisect_left
import math

from flask import Flask, render_template_string, request


EPS0 = 8.854187817e-12  # Vacuum permittivity (F/m)
OMEGA_FACTOR = 2 * math.pi  # Multiply by Hz to get angular frequency
UNIT_FACTORS = {
    "Hz": 1.0,
    "kHz": 1e3,
    "MHz": 1e6,
    "GHz": 1e9,
}
TISSUE_MODELS = {
    "fat": {
        "tissue": "Fat",
        "eps_inf": 3.1,
        "d_eps": [29.0, 7.5, 0.0, 0.0],
        "tau": [7.96e-12, 3.8e-10, 0.0, 0.0],
        "alpha": [0.1, 0.05, 0.0, 0.0],
        "sigma_i": 0.02,
    },
    "muscle": {
        "tissue": "Muscle",
        "eps_inf": 4.0,
        "d_eps": [45.0, 32.0, 4.0, 0.0],
        "tau": [7.23e-12, 6.5e-11, 3.6e-9, 0.0],
        "alpha": [0.1, 0.05, 0.02, 0.0],
        "sigma_i": 0.7,
    },
    "blood": {
        "tissue": "Blood",
        "eps_inf": 3.2,
        "d_eps": [60.0, 30.0, 4.0, 0.0],
        "tau": [8.1e-12, 5.5e-11, 3.8e-9, 0.0],
        "alpha": [0.1, 0.05, 0.02, 0.0],
        "sigma_i": 1.1,
    },
    "cortical_bone": {
        "tissue": "Cortical Bone",
        "eps_inf": 2.5,
        "d_eps": [13.0, 4.0, 0.0, 0.0],
        "tau": [6.8e-12, 4.7e-10, 0.0, 0.0],
        "alpha": [0.1, 0.05, 0.0, 0.0],
        "sigma_i": 0.02,
    },
    "skin": {
        "tissue": "Skin",
        "eps_inf": 4.5,
        "d_eps": [38.0, 28.0, 3.0, 0.0],
        "tau": [7.4e-12, 6.0e-11, 3.4e-9, 0.0],
        "alpha": [0.1, 0.05, 0.02, 0.0],
        "sigma_i": 0.4,
    },
}
TISSUE_OPTIONS = [(key, value["tissue"]) for key, value in TISSUE_MODELS.items()]
MODE_OPTIONS = [
    ("cole-cole", "Cole–Cole Mode"),
    ("table", "Table-Fit Mode"),
]
MODE_LABELS = dict(MODE_OPTIONS)
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
    omega = 2 * math.pi * frequency_ghz * 1e9
    return sigma / (omega * EPS0 * epsilon_r)


def compute_properties(frequency_hz: float, tissue_key: str, mode: str):
    if frequency_hz <= 0:
        raise ValueError("Frequency must be positive.")

    tissue_key = tissue_key.lower()
    if tissue_key not in TISSUE_MODELS:
        raise ValueError("Invalid tissue.")

    mode = mode.lower()
    if mode not in {"cole-cole", "table"}:
        raise ValueError("Invalid mode.")

    omega = OMEGA_FACTOR * frequency_hz

    if mode == "cole-cole":
        params = TISSUE_MODELS[tissue_key]
        eps_complex = complex(params["eps_inf"], 0.0)
        for delta_eps, tau, alpha in zip(params["d_eps"], params["tau"], params["alpha"]):
            if delta_eps == 0 or tau == 0:
                continue
            exponent = 1 - alpha
            denom = 1 + (1j * omega * tau) ** exponent
            eps_complex += delta_eps / denom
        eps_complex += params["sigma_i"] / (1j * omega * EPS0)
        eps_real = max(eps_complex.real, 0.0)
        eps_double_prime = abs(eps_complex.imag)
        tan_delta = eps_double_prime / eps_real if eps_real > 0 else float("nan")
        sigma = omega * EPS0 * eps_double_prime
        epsilon_imag = eps_double_prime
    else:
        coeffs = TABLE_FIT_COEFFS.get(tissue_key)
        if not coeffs:
            raise ValueError("Dataset incomplete.")
        freq_ghz = frequency_hz / 1e9
        if freq_ghz <= 0:
            raise ValueError("Frequency must be positive.")
        log_freq = math.log10(freq_ghz)
        eps_real = max(_evaluate_log_fit(coeffs.get("eps_r"), log_freq), 0.0)
        tan_delta = abs(_evaluate_log_fit(coeffs.get("tan_delta"), log_freq))
        eps_double_prime = abs(eps_real * tan_delta)
        sigma = omega * EPS0 * eps_double_prime
        epsilon_imag = eps_double_prime

    return {
        "epsilon_real": eps_real,
        "epsilon_imag": epsilon_imag,
        "conductivity": sigma,
        "loss_tangent": tan_delta,
        "mode": mode,
        "tissue": tissue_key,
    }


def _build_log_coefficients():
    coeffs = {}
    for tissue, points in TABLE_REFERENCE_POINTS.items():
        freq_values = sorted(points.items())
        if len(freq_values) < 2:
            continue
        (f1, v1), (f2, v2) = freq_values[:2]
        x1 = math.log10(f1)
        x2 = math.log10(f2)
        if x1 == x2:
            continue
        tissue_coeff = {}
        for key in ("eps_r", "tan_delta"):
            y1 = v1[key]
            y2 = v2[key]
            m = (y2 - y1) / (x2 - x1)
            b = y1 - m * x1
            tissue_coeff[key] = (m, b)
        coeffs[tissue] = tissue_coeff
    return coeffs


def _evaluate_log_fit(coeff, log_freq):
    if coeff is None:
        return float("nan")
    m, b = coeff
    return m * log_freq + b


# Legacy blood plasma/water calibration tables for glucose functionality
_BP_TABLE_ER = {
    0.5: {72: 72.75, 219: 72.73, 330: 72.71, 600: 72.66},
    2.5: {72: 69.74, 219: 69.70, 330: 69.67, 600: 69.59},
    5.0: {72: 64.62, 219: 64.56, 330: 64.51, 600: 64.39},
    10.0: {72: 53.24, 219: 53.14, 330: 53.07, 600: 52.88},
}

TABLE_REFERENCE_POINTS = {
    "skin": {
        1.575: {"eps_r": 39.28, "tan_delta": 0.32},
        5.2: {"eps_r": 35.61, "tan_delta": 0.31},
    },
    "fat": {
        1.575: {"eps_r": 5.37, "tan_delta": 0.15},
        5.2: {"eps_r": 5.01, "tan_delta": 0.18},
    },
    "muscle": {
        1.575: {"eps_r": 53.86, "tan_delta": 0.26},
        5.2: {"eps_r": 49.28, "tan_delta": 0.30},
    },
    "blood": {
        1.575: {"eps_r": 83.99219414819385, "tan_delta": 0.3630358010357819},
        5.2: {"eps_r": 64.08320320665837, "tan_delta": 0.4841530609714435},
    },
    "cortical_bone": {
        1.575: {"eps_r": 15.493917158583832, "tan_delta": 0.1400851610851716},
        5.2: {"eps_r": 14.33175714307555, "tan_delta": 0.2268649368276044},
    },
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
TABLE_FIT_COEFFS = _build_log_coefficients()


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
    .freq-input { display: flex; gap: 10px; align-items: center; }
    .freq-input input { flex: 1.2; margin-bottom: 0; font-size: 1.05rem; padding: 12px 14px; }
    .freq-input select { padding: 12px 14px; border-radius: 6px; border: 1px solid #ccd5db; background-color: #fff; font-size: 1.05rem; }
    .freq-input-wrapper { margin-bottom: 16px; }
    select { width: 100%; padding: 10px 12px; border-radius: 6px; border: 1px solid #ccd5db; background-color: #fff; font-size: 1rem; margin-bottom: 16px; }
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

      <label for="frequency">Frequency</label>
      <div class="freq-input-wrapper">
        <div class="freq-input">
          <input type="number" step="any" min="0" id="frequency" name="frequency" value="{{ frequency_value }}" required>
          <select name="frequency_unit">
            {% for unit in frequency_units %}
              <option value="{{ unit }}" {% if unit == frequency_unit %}selected{% endif %}>{{ unit }}</option>
            {% endfor %}
          </select>
        </div>
      </div>

      <label for="tissue">Tissue</label>
      <select id="tissue" name="tissue">
        {% for key, label in tissue_options %}
          <option value="{{ key }}" {% if key == selected_tissue %}selected{% endif %}>{{ label }}</option>
        {% endfor %}
      </select>

      <label for="mode">Mode</label>
      <select id="mode" name="mode">
        {% for key, label in mode_options %}
          <option value="{{ key }}" {% if key == selected_mode %}selected{% endif %}>{{ label }}</option>
        {% endfor %}
      </select>

      <button type="submit">Compute</button>
    </form>

    {% if tissue_result %}
      <div class="result">
        <strong>{{ tissue_result.title }}</strong>
        <div>ε<sub>r</sub> = {{ tissue_result.epsilon_real }}</div>
        <div>ε″ = {{ tissue_result.epsilon_imag }}</div>
        <div>tan&#948; = {{ tissue_result.loss_tangent }}</div>
        <div>σ = {{ tissue_result.conductivity }} S/m</div>
      </div>
    {% endif %}

    {% if glucose_result %}
      <div class="result">
        <strong>Computed at {{ frequency_display }}</strong>
        <div><em>Blood Plasma (Cole–Cole)</em>: ε<sub>r</sub> = {{ glucose_result.bp_eps_r }} | σ = {{ glucose_result.bp_sigma }} S/m | tan&#948; = {{ glucose_result.bp_loss }}</div>
        <div><em>De-ionized Water (Debye)</em>: ε<sub>r</sub> = {{ glucose_result.dw_eps_r }} | σ = {{ glucose_result.dw_sigma }} S/m | tan&#948; = {{ glucose_result.dw_loss }}</div>
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

    <div class="footer">Enter frequency and choose a tissue/mode to compute dielectric properties.</div>
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
        tissue_result = None
        glucose_result = None
        chart_curves = None
        glucose_raw = request.form.get("glucose", "").strip()
        frequency_raw = request.form.get("frequency", "").strip()
        frequency_unit = request.form.get("frequency_unit", "GHz")
        if frequency_unit not in UNIT_FACTORS:
            frequency_unit = "GHz"
        selected_tissue = request.form.get("tissue", "skin")
        if selected_tissue not in TISSUE_MODELS:
            selected_tissue = "skin"
        selected_mode = request.form.get("mode", "cole-cole")
        if selected_mode not in {"cole-cole", "table"}:
            selected_mode = "cole-cole"
        frequency_display = "—"

        if request.method == "POST":
            frequency = None
            glucose = None
            if glucose_raw:
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
                if frequency <= 0:
                    errors.append("Frequency must be positive.")

            if not errors and frequency is not None:
                unit_factor = UNIT_FACTORS.get(frequency_unit, 1.0)
                frequency_hz = frequency * unit_factor
                frequency_ghz = frequency_hz / 1e9
                frequency_display = f"{frequency:.6g} {frequency_unit}"

                try:
                    props = compute_properties(frequency_hz, selected_tissue, selected_mode)
                except ValueError as exc:
                    errors.append(str(exc))
                else:
                    mode_label = MODE_LABELS.get(selected_mode, selected_mode.title())
                    tissue_result = {
                        "title": f"{TISSUE_MODELS[selected_tissue]['tissue']} · {mode_label} ({frequency_display})",
                        "epsilon_real": f"{props['epsilon_real']:.6g}",
                        "epsilon_imag": f"{props['epsilon_imag']:.6g}",
                        "loss_tangent": f"{props['loss_tangent']:.6g}",
                        "conductivity": f"{props['conductivity']:.6g}",
                    }

                if not errors and glucose is not None:
                    bp_eps_r, bp_sigma = dielectric_BP(glucose, frequency_ghz)
                    dw_eps_r, dw_sigma = dielectric_DW(glucose, frequency_ghz)
                    bp_loss = compute_loss_tangent(bp_eps_r, bp_sigma, frequency_ghz)
                    dw_loss = compute_loss_tangent(dw_eps_r, dw_sigma, frequency_ghz)
                    glucose_result = {
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
            "tissue_result": tissue_result,
            "glucose_result": glucose_result,
            "glucose_value": glucose_raw,
            "frequency_value": frequency_raw,
            "frequency_unit": frequency_unit,
            "frequency_units": list(UNIT_FACTORS.keys()),
            "frequency_display": frequency_display,
            "chart_curves": chart_curves,
            "tissue_options": TISSUE_OPTIONS,
            "selected_tissue": selected_tissue,
            "mode_options": MODE_OPTIONS,
            "selected_mode": selected_mode,
        }
        return render_template_string(HTML_TEMPLATE, **context)

    return app


app = create_app()


def main():
    app.run(host="127.0.0.1", port=5000, debug=False)


if __name__ == "__main__":
    main()
