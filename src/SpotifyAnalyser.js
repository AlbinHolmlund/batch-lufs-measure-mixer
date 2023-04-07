import React, { useState, useEffect, useContext } from 'react';

import { LoudnessMeter } from '@domchristie/needles';
import PQueue from 'p-queue';
import { Context } from './Context';

// We have a queue to make sure that there isn't like 30 audio contexts running at once, which would be bad and cause the browser to crash (on mobile especially)
const queue = new PQueue({ concurrency: 2 });

const arrayBufferToHash = async (buffer) => {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

const getLufs = async (arrayBuffer) => {
    // Queue the function
    return await queue.add(async () => {
        // Create a new audio context
        // Create a new offline context
        const audioCtx = new AudioContext();

        // Decode the audio data
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));

        // Close the audio context
        if (audioCtx.close) {
            audioCtx.close();
            console.log('audioCtx closed');
        }

        console.log('audioBuffer', audioBuffer)

        var offlineCtx = new OfflineAudioContext(
            audioBuffer.numberOfChannels,
            audioBuffer.duration * audioBuffer.sampleRate,
            audioBuffer.sampleRate
        );

        // Create a new audio buffer source
        var source = offlineCtx.createBufferSource();

        // Set the audio buffer to the source
        source.buffer = audioBuffer;

        // Create a new loudness meter
        var loudnessMeter = new LoudnessMeter({
            source: source,
            modes: ['integrated'],
            workerUri: window.PUBLIC_URL + '/needles-worker.js'
        });

        // Start the loudness meter
        loudnessMeter.start();

        const lufs = await new Promise((resolve, reject) => {
            loudnessMeter.on('dataavailable', function (event) {
                // event.data.mode // momentary | short-term | integrated
                // short-term means the last 3 seconds
                // momentary means the last 400ms
                // event.data.value // -14
                // console.log(event.data.mode, event.data.value)
                if (event.data.mode === 'integrated') {
                    console.log('lufs', event.data.value)
                    resolve(event.data.value);
                }
            });
        });

        // Close the offline context
        if (offlineCtx.close) {
            offlineCtx.close();
            console.log('offlineCtx closed');
        }

        return lufs;
    });
};

const SpotifyAnalyser = ({ track, setTrackGainModifiers, ...props }) => {
    const updateGain = (normalizationGain) => {
        if (track) {
            //  track.gainNode.gain.value += track.gainModifiers.reduce((a, b) => a + b, 0);
            setTrackGainModifiers((trackGainModifiers) => {
                return {
                    ...trackGainModifiers,
                    normalizationGain,
                };
            });

        }
    };

    /*
        0. Wait for button click
        1. Get the track
        2. Use needles offline to get the LUFS
        3. Use the LUFS to set the gain
    */
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lufs, setLufs] = useState(null);
    const [gain, setGain] = useState(false);
    const [forceGain, setForceGain] = useState(false);

    useEffect(() => {
        if (track && forceGain) {
            setLoading(true);
            setError(null);
            setLufs(null);
            setGain(false);

            (async () => {
                try {
                    await new Promise((resolve, reject) => {
                        setTimeout(() => {
                            resolve();
                        }, 1000);
                    });

                    // Use exportAudioBuffer to get the LUFS
                    const arrayBuffer = track.audioData;

                    // Store in localStorage based on hash of blob
                    const hash = await arrayBufferToHash(arrayBuffer);

                    // Check if the hash exists in localStorage
                    const lufs = localStorage.getItem('hash_lufs_' + hash);
                    if (lufs) {
                        console.log('Obtaining LUFS for arrayBuffer from localStorage', arrayBuffer);
                        setLufs(lufs);
                        setLoading(false);

                        if (updateGain) {
                            // Use lufs to calculate gain reduction for spotify (-14 LUFS)
                            const gainReduction = -14 - lufs;

                            // Update the gain
                            updateGain(gainReduction);
                        }
                        return;
                    } else {
                        console.log('Obtaining LUFS for arrayBuffer', arrayBuffer);
                        const lufs = await getLufs(arrayBuffer);

                        // Use lufs to calculate gain reduction for spotify (-14 LUFS)
                        console.log('lufs', lufs);
                        const gainReduction = -14 - lufs;

                        setGain(parseFloat(gainReduction.toFixed(2)));
                        setLufs(parseFloat(lufs.toFixed(2)));
                        setLoading(false);
                        if (updateGain) {

                            // Update the gain
                            updateGain(parseFloat(gainReduction.toFixed(2)))
                        }

                        // Store in localStorage
                        localStorage.setItem(hash, lufs);
                    }
                } catch (e) {
                    console.error(e);
                    setError(e);
                    setLoading(false);
                }
            })();
        }
    }, [track, forceGain]);

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 55 + '%',
            }}
        >

            <legend
                class={"spotify-normalization " + (forceGain ? 'active' : '')}
                style={{
                    fontSize: '0.5em',
                    cursor: 'pointer',
                    textAlign: 'left',
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    setForceGain(!forceGain);
                    setLoading(false);
                    setError(null);
                    setLufs(null);
                    setGain(false);
                }}
            >
                <span style={{
                    // Color is spotify green (darker) if forceGain is true otherwise red
                    color: forceGain ? '#1db954' : '#b91d47',

                }}>{
                        forceGain ? 'Deactivate' : 'Activate'
                    } <br />
                    Normalization (Spotify)</span>
                <br />
                {loading && <div>Analyzing track...</div>}
                {error && <div>Error: {error.message}</div>}
                {lufs && <div>LUFS: {lufs}</div>}
                {gain && <div>Gain: {gain}</div>}
            </legend>
        </div>
    );
};

export default React.memo(SpotifyAnalyser);