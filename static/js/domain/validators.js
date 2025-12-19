export class Validators {

    static validateFrequency(val) {
        const num = parseFloat(val);
        if (isNaN(num)) return { valid: false, message: "Must be a number" };
        if (num <= 0) return { valid: false, message: "Must be positive" };
        // Optional: Upper limit check if needed
        return { valid: true };
    }

    static validateGlucose(val) {
        const num = parseFloat(val);
        if (isNaN(num)) return { valid: false, message: "Must be a number" };
        if (num < 0) return { valid: false, message: "Must be non-negative" };
        return { valid: true };
    }

    static validateAmplitude(val) {
        const num = parseFloat(val);
        if (isNaN(num)) return { valid: false, message: "Must be a number" };
        return { valid: true };
    }

    static validateOptimizationParams(params) {
        const errors = {};
        // Example checks for geometry
        const positiveFields = ['ring_count', 'h', 'g1', 'g2', 'g3', 'w1', 'w2', 'w3', 'ws', 'l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'lf', 'ls'];

        positiveFields.forEach(field => {
            if (params[field] < 0) {
                errors[field] = "Must be non-negative";
            }
        });

        return {
            valid: Object.keys(errors).length === 0,
            errors
        };
    }
}
