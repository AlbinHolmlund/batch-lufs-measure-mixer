import React, { useState, useEffect, useRef, useContext } from 'react';
import styled from 'styled-components';
// import Flag from "react-flags";
import AudioMixer from './AudioMixer';
import { cacheFiles } from './FileCache';
import Button from '@mui/material/Button';
// Checkbox
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
// Select dropdown
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import { useLanguage } from './useLanguage';
import useLocalStorage from './useLocalStorageState';

import { Context } from './Context';

const ClearButton = styled.button`
    background-color: transparent;
    border: none;
    color: #fff;
    cursor: pointer;
    font-size: 1.5em;
    padding: 0;
`;

let FileInputArea = ({ className, onChange, ...props }) => {
    const { __ } = useLanguage();
    return (
        <div className={className}  {...props}>
            <input type="file" multiple onChange={onChange} />
            <div className="message">
                <p>
                    {__('Click here to select audio files.')}
                </p>
            </div>
        </div>
    );
};

FileInputArea = styled(FileInputArea)`
    position: fixed;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: transparent;
    z-index: 100000;
    cursor: pointer;
    transition: background-color 0.5s;

    &:hover {
        background-color: rgba(0, 0, 0, 0.5);
    }

    .message {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        color: #fff;
        font-size: 2em;
        text-align: center;
    }

    input {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: pointer;
        z-index: 100000;
    }
`;

const flagMapping = {
    'sv': 'se',
    'en': 'gb',
    'no': 'no',
    'fi': 'fi',
    'da': 'dk',
    'de': 'de'
};

const LanguagePicker = ({ currentLanguage, setLanguage }) => {
    const buttonRef = useRef(null);
    const [open, setOpen] = useState(false);
    const { __ } = useLanguage();

    // Button triggers a menu
    return (
        <>
            <Button
                ref={buttonRef}
                onClick={() => setOpen(true)}
            >
                {__('Language')} <span style={{ marginLeft: '10px' }} className={`fi fi-${flagMapping[currentLanguage]}`}></span>
            </Button>

            <Menu
                id="language-picker"
                anchorEl={buttonRef.current}
                open={open}
                onClose={() => setOpen(false)}
                style={{ zIndex: 10000000000 }}
            >
                {['sv', 'en', 'no', 'fi', 'da', 'de'].map((lang) => {
                    const flag = (
                        <span
                            //class="fi fi-gr"
                            className={`fi fi-${flagMapping[lang]}`}
                        ></span>
                    );
                    return (
                        <MenuItem
                            key={lang}
                            onClick={() => {
                                setLanguage(lang);
                                setOpen(false);
                                window.dispatchEvent(new Event('infoMessageReset'));
                            }}
                        >
                            <span style={{ marginRight: '10px' }}>{flag}</span> {__(lang)}
                        </MenuItem>
                    );
                })}
            </Menu>
        </>
    );
};

const arrayBufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
};

const Toolbar = styled.div`
    margin-top: 40px;
    & > * {
        margin: 0 10px !important;
    }
`;

const ShowVisualizerToggle = () => {
    const ctx = useContext(Context);
    const [showVisualizer, setShowVisualizer] = useLocalStorage(
        'showVisualizer',
        false
    );

    useEffect(() => {
        console.log('showVisualizer', showVisualizer);
        ctx?.setData((data) => ({
            ...data,
            showVisualizer: showVisualizer,
        }));
    }, [showVisualizer]);

    return (
        <FormControlLabel
            control={
                <Checkbox
                    checked={showVisualizer}
                    onChange={(e) => setShowVisualizer(e.target.checked)}
                    name="showVisualizer"
                    color="primary"
                />
            }
            label="Show visualizer"
        />
    );
};

const KeepFocusToggle = () => {
    const { __ } = useLanguage();

    const [keepFocus, setKeepFocus] = useLocalStorage(
        'keepFocus',
        true
    );

    return (
        <Tooltip
            title={
                keepFocus ? __('Keep playing audio when clicking outside of the box') : __('Stop playing audio when clicking outside of the box')
            }
        >
            <FormControlLabel
                control={
                    <Checkbox
                        checked={keepFocus}
                        onChange={(e) => setKeepFocus(e.target.checked)}
                        name="keepFocus"
                        color="primary"
                    />
                }
                label={__('Keep focus')}
            />
        </Tooltip>
    );
};

// Multifile picker, with audio file type filter
const AudioFilePicker = () => {
    const { __, setLanguage, currentLanguage } = useLanguage();
    const [localStorageFiles, setLocalStorageFiles] = useState(null);
    const [files, setFiles] = useState([]);

    const [audioContext, setAudioContext] = useState(null);

    const handleFileChange = async (e) => {
        const files = e.target.files;

        if (!audioContext) {
            // Create audio context
            const audioContext = new AudioContext();
            setAudioContext(audioContext);
        }

        // Read the files as data uri
        const filesAsDataUri = Array.from(files).map((file) => {
            return new Promise((resolve, reject) => {
                // Read as array buffer
                const reader = new FileReader();
                reader.readAsArrayBuffer(file);
                reader.onload = () => {
                    resolve({
                        name: file.name || file.fileName,
                        // Get blob: url
                        data: reader.result,
                        dataUri: URL.createObjectURL(new Blob([reader.result])),
                        // data uri is base64 encoded
                        // dataUri: 'data:' + file.type + ';base64,' + arrayBufferToBase64(reader.result)
                    });
                }
                reader.onerror = reject;
            });
        });

        try {
            (async () => {
                // Cache the files
                try {
                    const files = await Promise.all(filesAsDataUri);
                    const urls = await cacheFiles(files.map((file) => {
                        return {
                            name: file.name,
                            dataUri: file.dataUri,
                            data: file.data
                        };
                    }))
                    console.log('done', urls);
                    // Save in localStorage
                    localStorage.setItem('files', JSON.stringify(urls));

                    // Immediately load the files
                    setLocalStorageFiles(JSON.parse(localStorage.getItem('files')));

                    // Remove the files from the input
                    setFiles([]);
                } catch (e) {
                    console.log(e);
                }
            })();
        } catch (e) {
            console.log(e);
        }

        // Set the files state
        /*Promise.all(filesAsDataUri).then((files) => {
            setFiles(files);
        });*/

        // Async test
        setFiles(filesAsDataUri);
    }

    useEffect(() => {
        // In dev mode, trigger handleFileChange with a file loaded from dummyFileUrl
        if (0 && window.location.href.indexOf(':3000') > -1) {
            window.localStorage.removeItem('files');
            const dummyFileUrl = '/audio/demo.wav';
            const handleOnClick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                fetch(dummyFileUrl).then((response) => response.arrayBuffer()).then((response) => {
                    const file = new File([response], 'demo.wav', { type: 'audio/wav' });
                    handleFileChange({
                        target: {
                            files: [file]
                        }
                    });
                });

                document.querySelector('html').removeEventListener('click', handleOnClick);
            };
            document.querySelector('html').addEventListener('click', handleOnClick);
            return () => {
                document.querySelector('html').removeEventListener('click', handleOnClick);
            };
        }
    }, []);

    useEffect(() => {
        if (localStorageFiles) {
            const urls = localStorageFiles;

            if (!audioContext) {
                // Create audio context
                const audioContext = new AudioContext();
                setAudioContext(audioContext);
            }

            // Read the files as data uri
            const filesAsDataUri = urls.map((url) => {
                return new Promise((resolve, reject) => {
                    // Read as array buffer
                    fetch(url).then((response) => response.arrayBuffer()).then((response) => {
                        // console.log(url, URL.createObjectURL(new Blob([response])));
                        resolve({
                            name: url,
                            // Get blob: url
                            data: response,
                            dataUri: URL.createObjectURL(new Blob([response])),
                        });
                    });
                });
            });

            setFiles(filesAsDataUri);
        }
    }, [localStorageFiles]);

    return (
        <div style={{ textAlign: 'center' }}>
            <FileInputArea
                onChange={handleFileChange}
                style={{
                    display: (files.length > 0 || localStorage.getItem('files')) ? 'none' : 'block'
                }}
            />

            {((files && files.length > 0) || localStorage.getItem('files')) && (
                <Toolbar>
                    {(localStorage.getItem('files') && !localStorageFiles) && (
                        <Button
                            onClick={() => {
                                setLocalStorageFiles(JSON.parse(localStorage.getItem('files')));
                            }}
                            color="primary"
                            style={{ backgroundColor: '#071318' }}
                            className="pulse"
                        >
                            {__('Restore last workspace')}
                        </Button>
                    )}

                    <Button
                        onClick={() => {
                            setFiles([]);
                            setAudioContext(null);
                            localStorage.removeItem('files');
                            setLocalStorageFiles(null);
                        }}
                        color="error"
                    >
                        {__('Clear workspace')}
                    </Button>

                    <LanguagePicker currentLanguage={currentLanguage} setLanguage={setLanguage} />

                    <br />

                    <KeepFocusToggle />

                    <ShowVisualizerToggle />
                </Toolbar>
            )}

            {((files && files.length > 0) || localStorageFiles) && (
                <AudioMixer
                    files={files}
                    audioContext={audioContext}
                />
            )}
        </div>
    );
}

export default AudioFilePicker;