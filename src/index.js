import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import RestApp from './RestApp';
import registerServiceWorker from './registerServiceWorker';

// ReactDOM.render(<App/>, document.getElementById('root'));
ReactDOM.render(<RestApp/>, document.getElementById('root'));
registerServiceWorker();
