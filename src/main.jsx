// main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<React.StrictMode><App /></React.StrictMode>);
} else {
  console.error("אלמנט root לא נמצא בדף. אנא ודא ש־index.html כולל <div id='root'>.");
}
