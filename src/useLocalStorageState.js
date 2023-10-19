import { useState, useEffect } from 'react';

const useLocalStorageState = (key, defaultValue) => {
    const [state, setState] = useState(() => {
        const valueInLocalStorage = window.localStorage.getItem(key);
        try {
            if (valueInLocalStorage) {
                return JSON.parse(valueInLocalStorage);
            }
            return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
        } catch (error) {
            console.log(error);
            return defaultValue;
        }
    });

    useEffect(() => {
        window.localStorage.setItem(key, JSON.stringify(state));
    }, [key, state]);

    return [state, setState];
};

export default useLocalStorageState;