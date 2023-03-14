import React, { useEffect } from 'react';
import './App.css';
import AudioFilePicker from './AudioFilePicker';

// Any time localStorage is updated, this component will re-render with the new value in the input
// And when the input is updated, the localStorage is updated
// So its a two-way binding between the input and localStorage to help with transferring data between computers and browsers


// Watch for lcalStorage changes
var originalSetItem = localStorage.setItem;
localStorage.setItem = function () {
  var event = new Event("itemInserted");
  document.dispatchEvent(event);

  originalSetItem.apply(this, arguments);
}


// We arent looking for a specific value, so we can just get all of localStorage
const localStorageKeys = Object.keys(localStorage);
const initialLocalStorageText = localStorageKeys.map((key) => {
  return `${key}: ${localStorage.getItem(key)}`;
}).join('\n');

const LocalStorageText = () => {
  const [display, setDisplay] = React.useState(false);
  const [text, setText] = React.useState(initialLocalStorageText);

  useEffect(() => {
    document.addEventListener("itemInserted", () => {
      // Update the text state
      const localStorageKeys = Object.keys(localStorage);
      setText(localStorageKeys.map((key) => {
        return `${key}: ${localStorage.getItem(key)}`;
      }).join('\n'));
    }, false);
  }, []);

  const handleChange = (e) => {
    const text = e.target.value;
    setText(text);

    // Try to update localStorage
    try {
      const lines = text.split('\n');
      lines.forEach((line) => {
        const [key, value] = line.split(':');
        localStorage.setItem(key.trim(), value.trim());
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      left: 0,
      bottom: 0,
      opacity: 0.05
    }}>
      <textarea
        style={{ display: display ? 'block' : 'none' }} cols="100" rows="20" value={text} onChange={handleChange}
      />

      <button
        onClick={() => setDisplay(!display)}
      >
        {display ? 'Hide' : 'Show'} localStorage
      </button>
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <AudioFilePicker />
      <LocalStorageText />
    </div>
  );
}

export default App;
