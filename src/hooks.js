import React, { useCallback, useEffect, useState } from "react";

const useRollingValues = (initialValue, windowSize) => {
    const [values, setValues] = useState(() => {
        return Array(windowSize).fill(initialValue);
    });

    const addValue = useCallback((value) => {
        setValues((values) => {
            const newValues = [...values];
            newValues.shift();
            newValues.push(value);
            return newValues;
        });
    }, []);

    return [values, addValue];
};

const useAmplifier = (initialValue, windowSize, factor) => {
    const [values, addValue] = useRollingValues(initialValue, windowSize);

    useEffect(() => {
        addValue(initialValue);
    }, [initialValue, addValue]);

    // Find the minimum and maximum values in the rolling window
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Amplify the current value based on the difference between the rolling minimum and maximum
    const amplifiedValue = initialValue + (max - min) * factor;
    // Test: 0.8 + (1 - 0.4) * 20

    return amplifiedValue;
};

const useNormalization = (initialValue, windowSize) => {
    // initialValue is an array of values that need to be normalized
    // Each value in the array is normalized to a value between 0 and 1 based on a rolling window and compared to min and max of that specific values window
    const [values, addValue] = useRollingValues(initialValue, windowSize);

    useEffect(() => {
        addValue(initialValue);
    }, [initialValue, addValue]);

    // Find the minimum and maximum values in the rolling window
    // Each item of the values array is an array of values, so we need to compare values by index in the array
    const normalizedValues = initialValue ? initialValue.map((value, index) => {
        // Compare each item in the array to the min and max of the rolling windows arrays
        const min = Math.min(...values.filter((v) => v).map((v) => v[index]));
        const max = Math.max(...values.filter((v) => v).map((v) => v[index]));

        // Normalize the current value based on the difference between the rolling minimum and maximum
        const normalizedValue = (max - min) === 0 ? 0 : (value - min) / (max - min);
        return normalizedValue;
    }) : [];

    return normalizedValues;
};


export { useAmplifier, useRollingValues, useNormalization };