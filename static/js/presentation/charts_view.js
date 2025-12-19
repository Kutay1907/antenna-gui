/**
 * Manages the Chart.js instances for the Results tab.
 */
export class ChartsView {
    constructor() {
        this.resChart = null;
        this.ampChart = null;
        this.shiftChart = null;
    }

    render(rows) {
        this.renderResonanceChart(rows);
        this.renderAmplitudeChart(rows);
        this.renderShiftChart(rows);
    }

    destroy() {
        if (this.resChart) this.resChart.destroy();
        if (this.ampChart) this.ampChart.destroy();
        if (this.shiftChart) this.shiftChart.destroy();
    }

    renderResonanceChart(rows) {
        const ctx = document.getElementById('resFreqChart');
        if (!ctx) return;

        if (this.resChart) this.resChart.destroy();

        // Sort rows by glucose for plotting
        const sorted = [...rows].sort((a, b) => a.glucose - b.glucose);
        const labels = sorted.map(r => r.glucose);

        this.resChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'S11 Frequency (GHz)',
                        data: sorted.map(r => r.s11_freq),
                        borderColor: '#1e88e5', // Blue
                        backgroundColor: '#1e88e5',
                        tension: 0.1
                    },
                    {
                        label: 'S21 Frequency (GHz)',
                        data: sorted.map(r => r.s21_freq),
                        borderColor: '#e53935', // Red
                        backgroundColor: '#e53935',
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: { display: true, text: 'Resonance Frequency vs Glucose' }
                },
                scales: {
                    x: { title: { display: true, text: 'Glucose (mg/dL)' } },
                    y: { title: { display: true, text: 'Frequency (GHz)' } }
                }
            }
        });
    }

    renderAmplitudeChart(rows) {
        const ctx = document.getElementById('ampChart');
        if (!ctx) return;

        if (this.ampChart) this.ampChart.destroy();

        const sorted = [...rows].sort((a, b) => a.glucose - b.glucose);
        const labels = sorted.map(r => r.glucose);

        this.ampChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'S11 Amplitude (dB)',
                        data: sorted.map(r => r.s11_amp),
                        borderColor: '#43a047', // Green
                        backgroundColor: '#43a047',
                        tension: 0.1
                    },
                    {
                        label: 'S21 Amplitude (dB)',
                        data: sorted.map(r => r.s21_amp),
                        borderColor: '#fb8c00', // Orange
                        backgroundColor: '#fb8c00',
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: { display: true, text: 'Amplitude vs Glucose' }
                },
                scales: {
                    x: { title: { display: true, text: 'Glucose (mg/dL)' } },
                    y: { title: { display: true, text: 'Amplitude (dB)' } }
                }
            }
        });
    }

    renderShiftChart(rows) {
        const ctx = document.getElementById('shiftChart');
        if (!ctx) return;

        if (this.shiftChart) this.shiftChart.destroy();

        const sorted = [...rows].sort((a, b) => a.glucose - b.glucose);
        const labels = sorted.map(r => r.glucose);

        // Calculate normalized shift (Shift relative to 0 mg/dL)
        const baseRow = sorted.find(r => r.glucose === 0);
        let data = [];

        if (baseRow) {
            data = sorted.map(r => r.s11_freq - baseRow.s11_freq);
        } else {
            // Fallback if no 0 base, just show 0 or raw? Requirement says normalized.
            // If no base, maybe show empty or raw. Let's show raw relative to first point if 0 missing?
            // "Normalized frequency shift vs glucose" usually implies Delta F = F(c) - F(0).
            // If F(0) missing, we can't compute Delta F properly.
            // Let's assume user must enter 0. If not, map to null.
            data = sorted.map(() => null);
        }

        this.shiftChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'S11 Freq Shift (GHz)',
                        data: data,
                        borderColor: '#8e24aa', // Purple
                        backgroundColor: '#8e24aa',
                        tension: 0.1,
                        borderDash: [5, 5]
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    title: { display: true, text: 'Normalized Frequency Shift (S11)' },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                if (ctx.raw === null) return 'Ref (0 mg/dL) missing';
                                return `${ctx.formattedValue} GHz`;
                            }
                        }
                    }
                },
                scales: {
                    x: { title: { display: true, text: 'Glucose (mg/dL)' } },
                    y: { title: { display: true, text: 'Shift (GHz)' } }
                }
            }
        });
    }
}
