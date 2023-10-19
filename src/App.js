import React, { useContext, useEffect, useState } from 'react';
import moment from 'moment';
import { AnimatePresence, motion } from 'framer-motion';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { createGlobalStyle } from 'styled-components';
import styled from 'styled-components';
import CssBaseline from '@mui/material/CssBaseline';
import Alert from '@mui/material/Alert';
import AudioFilePicker from './AudioFilePicker';
import { LanguageProvider, useLanguage } from './useLanguage';
import { LayoutGroup } from 'framer-motion';
import { Context } from './Context';

import translations from './translations.json';
import LogoVisualizer from './LogoVisualizer';

// Get current version from package.json
import packageJson from '../package.json';

/*
  To test the log message, run this in the console:
  window.dispatchEvent(new CustomEvent('infoMessage', {
    detail: {
      id: 'something',
      date: '2021-09-01 12:00:00',
      message: 'This is a test log message',
    },
  }));
*/

const githubRepository = 'https://api.github.com/repos/AlbinHolmlund/batch-lufs-measure-mixer/releases/latest';

// Check if there is a new version available
const githubDataPromise = (async () => {
  // Cache in localStorage for 1 hour
  const localStorageKey = 'newVersionAvailable';
  const localStorageValue = localStorage.getItem(localStorageKey);
  if (localStorageValue) {
    try {
      const { data, timestamp } = JSON.parse(localStorageValue);
      if (moment().diff(moment(timestamp), 'hours') < 1) {
        return data;
      }
    } catch (e) {
      console.log('Error parsing localStorageValue', e);
    }
  }

  const response = await fetch(githubRepository);
  const data = await response.json();
  localStorage.setItem(localStorageKey, JSON.stringify({
    data,
    timestamp: moment().format(),
  }));
  return data;
})();

const Header = styled.a`
  position: fixed;
  top: 0;
  left: 0;
  
  display: flex;
  align-items: center;
  justify-content: flex-start;
  z-index: 1000000000000;

  padding: 15px;

  ${LogoVisualizer} {
    height: 50px;
    padding-left: 60px;
    font-size: 0.8rem;
    font-weight: 700;
    color: #fff;
    display: flex;
    align-items: flex-end;
  }
`;


const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

const CssGlobals = createGlobalStyle`
  body {
    background-color: #0a1929 !important;
    color: #fff;
    padding-top: 100px;
  }

  .MuiTooltip-popper {
    .MuiTooltip-tooltip {
      background-color: #000;
    }
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

const AlertStyled = styled(motion.div)`
  white-space: pre-wrap;
  margin-bottom: 20px;
  a{
    display: block;
    color: inherit;
    &:after{
      content: ' →'
    }
  }
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

const InfoMessage = React.memo(({ children }) => {
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

  const [infoMessages, setInfoMessages] = useState([]);

  // Listen for window event called "infoMessage"
  useEffect(() => {
    window.addEventListener('infoMessage', (e) => {
      setInfoMessages((messages) => {
        return [...messages, e.detail];
      });
    });

    githubDataPromise.then((data) => {
      console.log('result', data);
      if (data) {
        const latestVersion = data.tag_name.replace('v', '');
        if (!(latestVersion !== packageJson.version)) {
          return;
        }

        const windowsUrl = data.assets.find((asset) => asset.name.includes('exe')).browser_download_url;
        const macUrl = data.assets.find((asset) => asset.name.includes('zip')).browser_download_url;
        window.dispatchEvent(
          new CustomEvent('infoMessage', {
            detail: {
              id: 'newVersionAvailable',
              date: moment().format('YYYY-MM-DD HH:mm:ss'),
              message: (
                <>
                  New version available: {data.tag_name.replace('v', '')}!
                  <a href={windowsUrl}>
                    Download for Windows
                  </a>
                  <a href={macUrl}>
                    Download for Mac
                  </a>
                </>
              )
            },
          })
        );
      }
    });
  }, []);

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

  return (
    <AlertContainer>
      <AnimatePresence>
        {infoMessages.map((message) => {
          return (
            <AlertStyled
              key={message.id}
              initial={{ opacity: 0, x: '-100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '-100%' }}
            >
              <Alert
                severity="success"
                onClose={() => {
                  setInfoMessages((messages) => {
                    return messages.filter((m) => m.id !== message.id);
                  });
                }}
              >
                {message.message}
              </Alert>
            </AlertStyled>
          );
        })}
        {display && (
          <AlertStyled
            initial={{ opacity: 0, x: '-100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '-100%' }}
          >
            <Alert
              severity="info"
              onClose={() => setDisplay(false)}
            >
              {__('infoMessage')}
            </Alert>
          </AlertStyled>
        )}
      </AnimatePresence>
    </AlertContainer>
  );
});

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

const DownloadContainer = styled.div`
  margin-top: 100px;
  text-align: center;
  font-weight: bold;
  position: relative;
  z-index: 200000;

  a{
    color:inherit;
    text-decoration: underline;
  }
`;


const Download = () => {
  const [data, setData] = React.useState(null);

  React.useEffect(() => {
    githubDataPromise.then((data) => {
      setData(data);
    });
  }, []);

  if (!data) {
    return (
      <DownloadContainer>
        <p>Build version v{packageJson.version}</p>
      </DownloadContainer>
    );
  }

  return (
    <DownloadContainer>
      <p>Build version v{packageJson.version}</p>
      <p>
        <a
          href={data.assets.find((asset) => asset.name.includes('exe')).browser_download_url}
        >
          Download for Windows
        </a> | <a
          href={data.assets.find((asset) => asset.name.includes('zip')).browser_download_url}
        >
          Download for Mac
        </a>
      </p>
    </DownloadContainer>
  );
};

function App() {
  const ctx = useContext(Context);
  return (
    <LanguageProvider translations={translations}>
      <ThemeProvider theme={darkTheme}>
        <LayoutGroup>
          <CssBaseline />
          <CssGlobals />

          <div className="App">
            <Header
              href="https://github.com/AlbinHolmlund/batch-lufs-measure-mixer"
              title="Batch LUFS Measure Mixer"
              target="_blank"
            >
              {!ctx.data.showVisualizer && (
                <LogoVisualizer
                  key="logo-visualizer"
                  layoutId="logo-visualizer"
                  layout
                  bass={ctx.data.bass || 0}
                  midToHigh={ctx.data.midToHigh || Array(10).fill(0)}
                  style={{
                    width: 100,
                    height: 100
                  }}
                />)}
            </Header>
            <AudioFilePicker
              key="audio-file-picker"
            />
            <LocalStorageText />

            <Download />
          </div>

          <InfoMessage />
        </LayoutGroup>
      </ThemeProvider>
    </LanguageProvider>
  );
}

export default App;
