import React, { useEffect, useState } from 'react';
import moment from 'moment';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { createGlobalStyle } from 'styled-components';
import styled from 'styled-components';
import CssBaseline from '@mui/material/CssBaseline';
import Alert from '@mui/material/Alert';
import AudioFilePicker from './AudioFilePicker';
import { LanguageProvider, useLanguage } from './useLanguage';

import translations from './translations.json';


const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

const CssGlobals = createGlobalStyle`
  body {
    background-color: #0a1929 !important;
    color: #fff;
  }

  .pulse {
	  animation: pulse-animation 2.5s infinite;
	}

	@keyframes pulse-animation {
		0% {
			box-shadow: 0 0 0 0px #42a5f565;
      background-color: var(--color-primary, #07131805);
		}
		80% {
			box-shadow: 0 0 10px 10px #42a5f500;
      background-color: var(--color-primary-hover, #071318);
		}
    100% {
			box-shadow: 0 0 10px 10px #42a5f500;
      background-color: var(--color-primary, #07131805);
    }
	}
`;

const DevMenu = styled.div`
  position: fixed;
  left: 0;
  bottom: 0;
  opacity: 0;
  transition: opacity 0.5s; 
  &:hover {
    opacity: 1;
  }
`;

const AlertContainer = styled.div`
  position: fixed;
  left: 20px;
  bottom: 20px;
  z-index: 1000000000000;
  max-width: 500px;
  max-width: min(500px, calc(100vw - 40px));
`;

const AlertStyled = styled(Alert)`
  white-space: pre-wrap;
`;

let dummyMessages = [
  {
    id: 'something',
    date: '2021-09-01 12:00:00',
    message: 'This is a test log message',
  },
  {
    id: 'something2',
    date: '2021-09-01 12:00:00',
    message: 'This is a test log message',
  },
];

// If the user has visited before (lastVisit is set in localStorage), then we will show the info messages based on date being greater than lastVisit.
const lastVisit = localStorage.getItem('lastVisit');
if (lastVisit) {
  dummyMessages = dummyMessages.filter((message) => {
    return moment(message.date).isAfter(lastVisit);
  });
}
localStorage.setItem('lastVisit', moment().format('YYYY-MM-DD HH:mm:ss'));

const InfoMessage = ({ children }) => {
  const { __ } = useLanguage();
  const [display, setDisplay] = useState(() => {
    const localStorageKey = 'infoMessage';
    const localStorageValue = localStorage.getItem(localStorageKey);
    if (localStorageValue === null) {
      localStorage.setItem(localStorageKey, 'true');
      return true;
    }
    return localStorageValue === 'true';
  });

  useEffect(() => {
    localStorage.setItem('infoMessage', display);
  }, [display]);

  useEffect(() => {
    // Listen for window event called "infoMessageReset"
    // window.dispatchEvent(new Event('infoMessageReset'));
    window.addEventListener('infoMessageReset', () => {
      setDisplay(true);
    });
  }, []);

  if (!display) {
    return null;
  }

  return (
    <AlertContainer>
      <AlertStyled severity="info" onClose={() => setDisplay(false)}>
        {__('infoMessage')}
      </AlertStyled>
    </AlertContainer>
  );
};

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
    <DevMenu>
      <textarea
        style={{ display: display ? 'block' : 'none' }} cols="100" rows="20" value={text} onChange={handleChange}
      />

      <button
        onClick={() => setDisplay(!display)}
      >
        {display ? 'Hide' : 'Show'} localStorage
      </button>
    </DevMenu>
  );
};

function App() {
  return (
    <React.StrictMode>
      <LanguageProvider translations={translations}>
        <ThemeProvider theme={darkTheme}>
          <CssBaseline />
          <CssGlobals />
          <div className="App">
            <AudioFilePicker />
            <LocalStorageText />
          </div>

          <InfoMessage />
        </ThemeProvider>
      </LanguageProvider>
    </React.StrictMode>
  );
}

export default App;
