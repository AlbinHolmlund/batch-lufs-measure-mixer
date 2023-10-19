import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styled from 'styled-components';
import toWav from 'audiobuffer-to-wav';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { LoudnessMeter } from '@domchristie/needles';

const translateVolume = (volumeInDB) => {
    // Convert db into gain
    return Math.pow(10, volumeInDB / 20);
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
    border: 1px solid black;
    width: 100%;
    height: 100%;
    flex-wrap: wrap;
`;

const MixerTrack = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border: 4px solid currentColor;
    border-radius: 5px;
    margin: 10px;
    color: #000;
    background-color: #fff;

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

const MixerTrackName = styled.div`
    font-size: 0.9em;
    font-weight: bold;
    text-align: left;
    padding: 5px;
    text-overflow: ellipsis;
    max-width: 100%;
    overflow: hidden;
    width: 200px;
    height: 2.5em;
    overflow: hidden;
`;

const MixerTrackVolume = styled.div`
    font-size: 1.5em;
    font-weight: bold;
`;

const MixerTrackVolumeSlider = styled(({ file, className, onChange, children }) => {
    const [volumeInDB, setVolumeInDB] = useLocalStorageState(file.name + '_volume', 0);

    useEffect(() => {
        onChange(volumeInDB);
    }, [volumeInDB, onChange]);

    return (
        <div className={className}>
            <input
                type="range"
                orient="vertical"
                min="-5"
                max="5"
                step="0.1"
                style={{
                    cursor: 'pointer',
                    display: 'block',
                    width: '100%',
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
    width: 100%;
`;

let AnalyzerNode = styled.canvas`
    width: 100%;
    height: 100px;
`;

const calculateLufs = (dataArray) => {
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += Math.pow(10, dataArray[i] / 20);
    }
    const rms = Math.sqrt(sum / dataArray.length);
    return 20 * Math.log10(rms);
}

const MouseFollower = ({ children, ...props }) => {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    const updateMousePosition = (e) => {
        setMousePosition({ x: e.clientX, y: e.clientY });
    }

    useEffect(() => {
        window.addEventListener('mousemove', updateMousePosition);
        return () => window.removeEventListener('mousemove', updateMousePosition);
    }, []);

    return (
        <div
            {...props}
            style={{
                position: 'fixed',
                marginTop: '-0.5em',
                marginLeft: 40,
                zIndex: 1000000,
                pointerEvents: 'none',
                //mixBlendMode: 'difference',
                fontSize: '1.5em',
                color: '#f00',
                fontWeight: 'bold',
                padding: '0.5em',
                backgroundColor: '#fff',
                boxShadow: '0 0 10px #000',
                borderRadius: '5px',
                top: mousePosition.y,
                left: mousePosition.x,
            }}
        >
            {children}
        </div>
    );
}

const MixerTrackAnalyzer = ({ track }) => {
    const [value, setValue] = useState(0);
    const [gainNode, setGainNode] = useState(null);

    useEffect(() => {
        // Watch for changes in the track ref with interval
        const interval = setInterval(() => {
            if (track && track.current && track.current.gainNode !== gainNode) {
                setGainNode(track.current.gainNode);
            } else if (!track || !track.current) {
                setGainNode(null);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [track, gainNode]);

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
                console.log(event.data.mode, event.data.value)
                // if (event.data.mode === 'short-term') {
                if (event.data.mode === 'momentary') {
                    if (event.data.value > -Infinity) {
                        setValue(event.data.value);
                    } else {
                        setValue(0);
                    }
                }
            });
            loudnessMeter.start()
            return () => {
                loudnessMeter.stop();
                setValue(0);
            };
        }
    }, [gainNode]);

    return createPortal((
        <MouseFollower>
            <span>{value && value.toFixed(1)} LUFS</span>
        </MouseFollower>
    ), document.body);
};


const exportAudioBuffer = async (audioBuffer, fileName, volumeInDB, returnValue) => {
    let offlineCtx = new OfflineAudioContext(2, audioBuffer.length, audioBuffer.sampleRate);
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
    // Tracks contains a gain node and an audio buffer source node
    // So to set the +-5 dB volume, we need to set the gain node's gain value on value change
    const [tracks, setTracks] = useState(null);
    const activeTrackRef = React.useRef(null);

    useEffect(() => {
        (async () => {
            if (files) {
                const fileNodesPromises = files.map(async (file) => {
                    // Create a gain node
                    const gainNode = audioContext.createGain();

                    // Create an audio buffer source node
                    const audioBufferSourceNode = audioContext.createBufferSource();

                    // Connect the audio buffer source node to the gain node
                    audioBufferSourceNode.connect(gainNode);

                    // Set the audio array source node's buffer
                    audioBufferSourceNode.buffer = new audioContext.decodeAudioData(file.dataUri);

                    // Connect the gain node to the audio context's destination
                    // gainNode.connect(audioContext.destination);

                    // Start the audio buffer source node
                    audioBufferSourceNode.start();

                    // Loop
                    audioBufferSourceNode.loop = true;

                    return {
                        audioBuffer: file,
                        audioBufferSourceNode,
                        gainNode
                    };
                });

                const fileNodes = await Promise.all(fileNodesPromises);

                // Set the tracks state
                setTracks(fileNodes);
            }
        })();
    }, [files, audioContext]);

    const handlePlay = (track) => {
        // Pause current track
        if (activeTrackRef.current) {
            // Disconnect
            activeTrackRef.current.gainNode.disconnect();
            activeTrackRef.current = null;
        }

        // Connect
        track.gainNode.connect(audioContext.destination);

        // Set the active track ref
        activeTrackRef.current = track;

        // Set analyser node to this
        // analyserNode.current = track.gainNode;
    }

    const handleStop = (track) => {
        // Disconnect
        track.gainNode.disconnect();

        // Set the active track ref
        activeTrackRef.current = null;
    }

    return (
        <>
            <MixerContainer>
                {tracks && tracks.map((track, index) => {
                    return (
                        <MixerTrack
                            key={index}
                            onMouseEnter={() => handlePlay(track)}
                            onMouseLeave={() => handleStop(track)}
                        >
                            <MixerTrackName>{track.audioBuffer.name}</MixerTrackName>
                            <MixerTrackVolume>
                                <MixerTrackVolumeSlider
                                    file={track.audioBuffer}
                                    onChange={(volumeInDB) => {
                                        // Set the gain node's gain value
                                        // Basically if volumeInDB is 0, then the gain is 1 (no change)
                                        // If volumeInDB is 5, then the gain is 10 (10x louder)
                                        // If volumeInDB is -5, then the gain is 0.1 (10x quieter)          
                                        track.gainNode.gain.value = translateVolume(volumeInDB);

                                        // If you want to use a linear scale, then you can use this:

                                        // const volumeInLinearScale = Math.pow(10, volumeInDB / 20);
                                    }}
                                />

                                <button
                                    onClick={() => {
                                        handlePlay(track);
                                    }}
                                >Play</button>

                                <button
                                    onClick={() => {
                                        handleStop(track);
                                    }}
                                >Stop</button>

                                <hr />

                                <button
                                    onClick={() => {
                                        // Export the audio buffer
                                        exportAudioBuffer(track.audioBufferSourceNode.buffer, track.audioBuffer.name, track.gainNode.gain.value);
                                    }}
                                >
                                    Export
                                </button>
                            </MixerTrackVolume>
                        </MixerTrack>
                    );
                })}
            </MixerContainer>

            {activeTrackRef && (
                <MixerTrackAnalyzer
                    track={activeTrackRef}
                />
            )}

            <div>
                <button
                    onClick={() => {
                        // Export all
                        (async () => {
                            var zip = new JSZip();
                            var blobs = await Promise.all(tracks.map((track) => {
                                return exportAudioBuffer(track.audioBufferSourceNode.buffer, track.audioBuffer.name, track.gainNode.gain.value, true);
                            }));

                            blobs.forEach((blob, index) => {
                                zip.file(tracks[index].audioBuffer.name, blob);
                            });

                            zip.generateAsync({ type: 'blob' }).then(function (content) {
                                // see FileSaver.js
                                saveAs(content, 'audio.zip');
                            });
                        })();
                    }}
                >

                    Export all
                </button>
            </div>
        </>
    );
}

export default AudioMixer;