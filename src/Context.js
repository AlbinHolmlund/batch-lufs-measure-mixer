import React, { createContext, useState } from 'react';

const Context = createContext();

const Provider = ({ children }) => {
    const [data, setData] = useState({
        showVisualizer: false

    });

    return (
        <Context.Provider value={{ data, setData }}>
            {children}
        </Context.Provider>
    );
}

export { Context, Provider };

/* 
    Usage
    import { Context, Provider } from './Context';
    <Provider>
        <Context.Consumer>
            {({ data, setData }) => {
                // Do stuff with data and setData
            }
        </Context.Consumer>
    </Provider>
*/