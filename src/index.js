import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { Provider } from './Context';
import reportWebVitals from './reportWebVitals';

// Render app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render((
  <Provider>
    <App />
  </Provider>
));

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// Add cmd + a
document.addEventListener('keydown', (e) => {
  if (e.metaKey && e.key === 'a') {
    e.preventDefault();
    document.execCommand('selectAll');
  }
});