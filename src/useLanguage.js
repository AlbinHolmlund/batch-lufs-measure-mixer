import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';

// Create a LanguageContext for providing and consuming language-related values
const LanguageContext = createContext();

// LanguageProvider wraps your app and provides languages and translations
export const LanguageProvider = ({ children, translations }) => {
    const [currentLanguage, setCurrentLanguage] = useState(() => {
        const localStorageKey = 'language';
        const localStorageValue = localStorage.getItem(localStorageKey);
        if (localStorageValue === null) {
            localStorage.setItem(localStorageKey, 'en');
            return 'en';
        }
        return localStorageValue;
    });

    useEffect(() => {
        localStorage.setItem('language', currentLanguage);
    }, [currentLanguage]);

    const value = useMemo(() => ({ currentLanguage, setCurrentLanguage, translations }), [
        currentLanguage,
        setCurrentLanguage,
        translations,
    ]);

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

// useLanguage is a custom hook for accessing the language context
export const useLanguage = () => {
    const context = useContext(LanguageContext);

    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }

    const { currentLanguage, setCurrentLanguage, translations } = context;

    // Translate the given text based on the current language, or fall back to the original text
    const __ = (text) => {
        if (
            translations.hasOwnProperty(text) &&
            translations[text].hasOwnProperty(currentLanguage)
        ) {
            return translations[text][currentLanguage];
        }
        console.log(`Missing translation for "${text}" in language "${currentLanguage}"`);
        translations[text] = { ...(translations[text] || {}), [currentLanguage]: text };
        console.log('translations', translations);
        return text;
    };

    return { __, setLanguage: setCurrentLanguage, currentLanguage };
};
