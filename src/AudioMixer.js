import React, { useRef, useState, useEffect, useMemo, useLayoutEffect } from 'react';
//  import { createPortal } from 'react-dom';
import styled from 'styled-components';
import Button from '@mui/material/Button';

import toWav from 'audiobuffer-to-wav';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { LoudnessMeter } from '@domchristie/needles';
import { useLanguage } from './useLanguage';


const translateVolume = (volumeInDB) => {
    // Convert db into gain
    return Math.pow(10, volumeInDB / 20);
}

const DomInjector = ({ inject, children, ...props }) => {
    const ref = React.useRef(null);
    const [hasInjected, setHasInjected] = useState(false);

    const el = useMemo(() => {
        return <div key="dom-injector" ref={ref} {...props} />;
    }, [props]);

    useLayoutEffect(() => {
        var undoInject = null;
        if (ref.current) {
            undoInject = inject(ref.current);
            setHasInjected(true);
        }
        return () => {
            if (undoInject) {
                undoInject();
            }
        }
    }, [inject]);

    return (
        <>
            {!hasInjected && children}
            {el}
        </>
    );
}

const useLocalStorageState = (key, defaultValue) => {
    const [state, setState] = useState(() => {
        const valueInLocalStorage = window.localStorage.getItem(key);
        if (valueInLocalStorage) {
            return JSON.parse(valueInLocalStorage);
        }
        return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
    });

    useEffect(() => {
        window.localStorage.setItem(key, JSON.stringify(state));
    }, [key, state]);

    return [state, setState];
};

const MixerContainer = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    flex-wrap: wrap;
    text-align: center;
`;

const MixerTrack = styled.div`
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 4px solid currentColor;
    border-radius: 5px;
    margin: 10px;
    color: #000;
    background-color: #fff;
    transition: all 0.2s ease-in-out;
    
    min-height: 100%;
    flex: 1 1 auto 100%;

    &:hover{
        box-shadow: 0 0 0 2px rgba(255,255,255,0.5);
    }
    &:focus, &:focus-within{
        box-shadow: 0 0 0 4px #fff !important;
    }

    button{
        margin: 5px;
        background-color: #000;
        border: 2px solid #222;
        color: #fff;
        font-weight: bold;
        border-radius: 5px;
        padding: 0 5px;
        cursor: pointer;

        &:hover{
            background-color: #000;
            color: #fff;
        }
    }
`;

const PlaceholderMixerTrack = styled(MixerTrack)`
    pointer-events: none;
    opacity: 0.25;
`;


const MixerTrackName = styled.div`
    font-size: 0.9em;
    font-weight: bold;
    text-align: left;
    padding: 5px;
    text-overflow: ellipsis;
    max-width: 100%;
    overflow: hidden;
    width: 200px;
    height: 3.5em;
    overflow: hidden;
`;

const MixerTrackVolume = styled.div`
    font-size: 1.5em;
    font-weight: bold;
`;

const MixerTrackVolumeSlider = styled(({ file, className, onChange, children }) => {
    const [volumeInDB, setVolumeInDB] = useLocalStorageState((file && file.name || 'none') + '_volume', 0);

    useEffect(() => {
        onChange && onChange(volumeInDB);
    }, [volumeInDB, onChange]);

    return (
        <div className={className}>
            {children}
            <input
                type="range"
                orient="vertical"
                min="-5"
                max="5"
                step="0.1"
                style={{
                    display: 'block',
                    margin: '10px auto'
                }}
                onChange={(e) => {
                    const volumeInDB = parseFloat(e.target.value);
                    setVolumeInDB(volumeInDB);
                }}
                onDoubleClick={() => {
                    setVolumeInDB(0);
                }}
                value={volumeInDB}
            />
            <input
                type="number"
                min="-5"
                max="5"
                step="0.1"
                value={`${volumeInDB}`}
                onChange={(e) => {
                    const volumeInDB = parseFloat(e.target.value);
                    if (!isNaN(volumeInDB)) {
                        setVolumeInDB(volumeInDB);
                    }
                }}
            />
            <div>{
                volumeInDB > 0 ? `+${volumeInDB} dB` : `${volumeInDB} dB`
            }</div>
        </div>
    )
})`
    position: relative;
    width: 100%;

    input[type="range"]{
        cursor: grab;
    }
    input[type="range"]:active{
        cursor: grabbing;
    }
`;

const formatLufs = (lufs) => {
    // Lock to 1 decimal, and keep 1 decimal if it's a whole number
    return Math.round(lufs * 10) / 10;
}

let MixerTrackAnalyzer = ({ gainNode, ...props }) => {
    const loudnessMeterRef = useRef();
    const [shortTerm, setShortTerm] = useState(0);
    const [momentary, setMomentary] = useState(0);
    const [integrated, setIntegrated] = useState(0);

    useEffect(() => {
        if (gainNode) {
            var loudnessMeter = new LoudnessMeter({
                source: gainNode,
                workerUri: '/needles-worker.js'
            });
            loudnessMeter.on('dataavailable', function (event) {
                // event.data.mode // momentary | short-term | integrated
                // short-term means the last 3 seconds
                // momentary means the last 400ms
                // event.data.value // -14
                // console.log(event.data.mode, event.data.value)
                // if (event.data.mode === 'short-term') {
                if (event.data.value > -Infinity) {
                    if (event.data.mode === 'short-term') {
                        setShortTerm(event.data.value);
                    } else if (event.data.mode === 'momentary') {
                        setMomentary(event.data.value);
                    } else if (event.data.mode === 'integrated') {
                        setIntegrated(event.data.value);
                    }
                } else {
                    if (event.data.mode === 'short-term') {
                        setShortTerm(0);
                    } else if (event.data.mode === 'momentary') {
                        setMomentary(0);
                    } else if (event.data.mode === 'integrated') {
                        setIntegrated(0);
                    }
                }
            });
            loudnessMeter.start()
            loudnessMeterRef.current = loudnessMeter;
            return () => {
                loudnessMeter.stop();
                setShortTerm(0);
                setMomentary(0);
                setIntegrated(0);
            };
        }
    }, [gainNode]);

    return (
        <div {...props} onClick={(e) => {
            e.stopPropagation();
            // Reset the meter
            if (loudnessMeterRef.current) {
                loudnessMeterRef.current.reset();
            }
        }}>
            <legend>
                <span>Short Term</span>
                {formatLufs(shortTerm)}
            </legend>
            <legend>
                <span>Momentary</span>
                {formatLufs(momentary)}
            </legend>
            <legend>
                <span>Integrated</span>
                {formatLufs(integrated)}
            </legend>
        </div>
    );
};

MixerTrackAnalyzer = styled(MixerTrackAnalyzer)`
    position: absolute;
    top: 0;
    left: 25%;
    z-index: 1000000;
    cursor: cell;
    background: transparent;
    transform: translateX(-50%);
    legend {
        justify-content: space-between;
        margin-bottom: 0.5em;
        flex-direction: column;
        align-items: flex-start;
        font-size: 0.9em;
        text-align: right;
        &:after{
            content: 'LUFS';
            margin-left: 10px;
            font-size: 0.5em;
            display: inline-block;
        }
        span {
            display: block;
            font-weight: bold;
            font-size: 0.5em;
            text-transform: uppercase;
            text-align: left;
        }
        &:nth-child(1){
            color: darkred;
        }
    }
`;


const exportAudioBuffer = async (audioBuffer, fileName, volumeInDB, returnValue) => {
    // Create a new offline context
    console.log('exportAudioBuffer', audioBuffer);

    let offlineCtx = new OfflineAudioContext(
        audioBuffer.numberOfChannels, // 2
        audioBuffer.length, // 44100 * 10
        audioBuffer.sampleRate, // 44100
    );
    let bufferSource = offlineCtx.createBufferSource();
    let gainNode = offlineCtx.createGain();

    bufferSource.buffer = audioBuffer;
    bufferSource.connect(gainNode);
    gainNode.connect(offlineCtx.destination);
    gainNode.gain.value = volumeInDB;

    bufferSource.start();

    return offlineCtx.startRendering().then(function (renderedBuffer) {
        // Convert the audio buffer to a blob
        const wav = toWav(renderedBuffer);
        const blob = new Blob([wav], { type: 'audio/wav' });

        if (returnValue) {
            return blob;
        }

        // Create a link to download the blob
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        // window.URL.revokeObjectURL(url);
        console.log('done', url);
    });
};

// Only one mixer at a time, and it connects to the audio context via props. The volume is based on dB, and the slider is based on a linear scale. Apply volume to the audio as a step before sending it to the audio context.
const AudioMixer = ({ files, audioContext }) => {
    const { __ } = useLanguage();

    // Tracks contains a gain node and an audio buffer source node
    // So to set the +-5 dB volume, we need to set the gain node's gain value on value change
    const [tracks, setTracks] = useState(null);
    const [highPerfMode, setHighPerfMode] = useState(false);
    const activeTrackRef = React.useRef(null);

    useEffect(() => {
        (async () => {
            if (files && audioContext && !tracks) {
                const fileNodesPromises = files.map(async (file, index) => {
                    file = await file;  // New async approach

                    // Create a gain node
                    const gainNode = audioContext.createGain();

                    // Apply the file data to a new audio dom element and then connect it to the gain node
                    // file.dataUrl
                    const audio = new Audio();
                    audio.src = file.dataUri;
                    audio.controls = true;
                    audio.loop = true;
                    audio.play();
                    const audioSource = audioContext.createMediaElementSource(audio);
                    audioSource.connect(gainNode);

                    // Connect gainNode to a special node that we will use to mute the track
                    const muteNode = audioContext.createGain();
                    muteNode.gain.value = 0; // 0 = muted, 1 = unmuted
                    gainNode.connect(muteNode);

                    // Connect the mute node to the audio context destination
                    muteNode.connect(audioContext.destination);

                    return {
                        index,
                        name: file.name,
                        audioBuffer: await audioContext.decodeAudioData(file.data),
                        audioBufferSourceNode: audioSource,
                        audio,
                        gainNode,
                        muteNode,
                        mute: () => {
                            // Ramp down the gain value to 0
                            muteNode.gain.setTargetAtTime(0, audioContext.currentTime, 0.1);
                            // Other ramps are available
                            // muteNode.gain.exponentialRampToValueAtTime(0, audioContext.currentTime + 0.1);
                            // muteNode.gain.setTargetAtTime(0, audioContext.currentTime, 0.1);
                        },
                        unmute: () => {
                            // Ramp up the gain value to 1
                            muteNode.gain.setTargetAtTime(1, audioContext.currentTime, 0.1);
                        }
                    };
                });

                // const fileNodes = await Promise.all(fileNodesPromises);

                // Set the tracks state
                // setTracks(fileNodes);

                // Set array of correct length
                if (tracks === null) {
                    setTracks(Array(files.length).fill(null));
                }

                fileNodesPromises.forEach(async (fileNodePromise) => {
                    const fileNode = await fileNodePromise;
                    setTracks((tracks) => {
                        // Replace at index
                        tracks[fileNode.index] = fileNode;
                        return [...tracks];
                    });
                });
            }
        })();
    }, [files, tracks, audioContext]);

    const handlePlay = (track) => {
        // Pause current track
        if (activeTrackRef.current) {
            // Disconnect
            // activeTrackRef.current.muteNode.disconnect();
            // activeTrackRef.current = null;
            activeTrackRef.current.mute();
        }

        // Connect
        // track.muteNode.connect(audioContext.destination);
        track.unmute();

        // Set the active track ref
        activeTrackRef.current = track;

        // Set analyser node to this
        // analyserNode.current = track.gainNode;
    }

    const handleStop = (track) => {
        // Disconnect
        // track.muteNode.disconnect();
        track.mute();

        // Set the active track ref
        activeTrackRef.current = null;
    }

    return (
        <>
            <div>
                {tracks && tracks.length ? (
                    <>
                        <Button
                            onClick={() => {
                                // Export all
                                setHighPerfMode(true);
                                (async () => {
                                    var zip = new JSZip();
                                    var blobs = await Promise.all(tracks.map((track) => {
                                        return exportAudioBuffer(track.audioBuffer, track.name, track.gainNode.gain.value, true);
                                    }));

                                    blobs.forEach((blob, index) => {
                                        zip.file(tracks[index].name, blob);
                                    });

                                    zip.generateAsync({ type: 'blob' }).then(function (content) {
                                        // see FileSaver.js
                                        saveAs(content, 'audio.zip')

                                        setHighPerfMode(false);
                                    });
                                })();
                            }}
                        >
                            {__('Export all')}
                        </Button>
                        <Button
                            onClick={() => {
                                // highPerfMode
                                setHighPerfMode(!highPerfMode);
                            }}
                        >
                            {__(highPerfMode ? 'Enable LUFS meters' : 'Disable LUFS meters')}
                        </Button>
                    </>
                ) : null}
            </div>
            <MixerContainer>
                {tracks && tracks.map((track, index) => {
                    if (!track) {
                        return (
                            <PlaceholderMixerTrack>
                                <MixerTrackName>
                                    <span>
                                        {__('Loading...')}
                                    </span>
                                </MixerTrackName>
                                <MixerTrackVolume>
                                    <MixerTrackVolumeSlider />
                                </MixerTrackVolume>
                                <button>
                                    {__('Export')}
                                </button>
                                <audio controls />
                            </PlaceholderMixerTrack>
                        );
                    }
                    return (
                        <MixerTrack
                            key={index}
                            //onMouseEnter={() => handlePlay(track)}
                            //onMouseLeave={() => handleStop(track)}
                            // Make focusable so that we can use the keyboard to play and stop
                            tabIndex={0}
                            onFocus={() => {
                                if (activeTrackRef.current !== track) {
                                    handlePlay(track);
                                }
                            }}
                            onBlur={() => {
                                if (activeTrackRef.current === track) {
                                    handleStop(track);
                                }
                            }}
                        >
                            <MixerTrackName>{track.name}</MixerTrackName>
                            <MixerTrackVolume>
                                <MixerTrackVolumeSlider
                                    file={track}
                                    onChange={(volumeInDB) => {
                                        // Set the gain node's gain value
                                        // Basically if volumeInDB is 0, then the gain is 1 (no change)
                                        // If volumeInDB is 5, then the gain is 10 (10x louder)
                                        // If volumeInDB is -5, then the gain is 0.1 (10x quieter)          
                                        track.gainNode.gain.value = translateVolume(volumeInDB);

                                        // If you want to use a linear scale, then you can use this:

                                        // const volumeInLinearScale = Math.pow(10, volumeInDB / 20);
                                    }}
                                >
                                    {!highPerfMode && (
                                        <MixerTrackAnalyzer
                                            gainNode={track.gainNode}
                                        />
                                    )}
                                </MixerTrackVolumeSlider>

                                <Button
                                    onClick={() => {
                                        // Export the audio buffer
                                        exportAudioBuffer(track.audioBuffer, track.name, track.gainNode.gain.value);
                                    }}
                                >
                                    {__('Export')}
                                </Button>

                                <DomInjector
                                    key={index}
                                    id={`audio-mixer-loudness-meter-${index}`}
                                    inject={(el) => {
                                        console.log('injecting', el);
                                        el.appendChild(track.audio);
                                        return () => {
                                            console.log('unmounting', el);
                                            track.audio.remove();
                                        }
                                    }}
                                >
                                    <audio controls />
                                </DomInjector>
                            </MixerTrackVolume>
                        </MixerTrack>
                    );
                })}
            </MixerContainer>
        </>
    );
}

export default AudioMixer;