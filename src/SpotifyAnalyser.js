import React, { useState, useEffect, useContext } from 'react';

import { LoudnessMeter } from '@domchristie/needles';
import PQueue from 'p-queue';
import { Context } from './Context';

// We have a queue to make sure that there isn't like 30 audio contexts running at once, which would be bad and cause the browser to crash (on mobile especially)
var queue = new PQueue({ concurrency: 2 });

var arrayBufferToHash = async (buffer) => {
    var hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    var hashArray = Array.from(new Uint8Array(hashBuffer));
    var hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

let activeLufs = null;

var getLufs = async (track, arrayBuffer) => {
    if (activeLufs) {
        await activeLufs;

        activeLufs = null;
    }

    var lufsPromise = new Promise(async (resolve, reject) => {
        await queue.add(async () => {

            await new Promise((resolve, reject) => {
                setTimeout(() => {
                    resolve();
                }, 1000);
            });

            // Create a new audio context
            // Create a new offline context
            let audioCtx = new AudioContext();

            // Decode the audio data with the gainNode applied
            let audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));

            var gainOfflineCtx = new OfflineAudioContext(
                audioBuffer.numberOfChannels,
                audioBuffer.duration * audioBuffer.sampleRate,
                audioBuffer.sampleRate
            );

            // Create a new audio buffer source
            var gainSource = gainOfflineCtx.createBufferSource();

            // Set the audio buffer to the source
            gainSource.buffer = audioBuffer;

            // Create a new gain node
            var gainNode = gainOfflineCtx.createGain();
            gainNode.gain.value = track.gainNode.gain.value;

            // Set the gain node to the source
            gainSource.connect(gainNode);

            // Connect the gain node to the offline context
            gainNode.connect(gainOfflineCtx.destination);

            // Start the source
            gainSource.start();

            // Render the audio
            audioBuffer = await gainOfflineCtx.startRendering();

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

            var lufs = await new Promise((resolve, reject) => {
                loudnessMeter.on('dataavailable', function (event) {
                    // event.data.mode // momentary | short-term | integrated
                    // short-term means the last 3 seconds
                    // momentary means the last 400ms
                    // event.data.value // -14
                    // console.log(event.data.mode, event.data.value)
                    if (event.data.mode === 'integrated') {
                        // Cleanup
                        source.buffer = null;

                        if (loudnessMeter && loudnessMeter.stop && loudnessMeter.state !== 'inactive') {
                            loudnessMeter.stop();
                        }

                        // Close the offline context
                        if (offlineCtx.close) {
                            offlineCtx.close();
                            console.log('offlineCtx closed');
                        }

                        if (event.data.value === -Infinity) {
                            reject(new Error('LUFS is -Infinity'));
                        }

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

            // Resolve the lufs
            resolve(lufs);
        });
    });

    // Set activeLufs
    activeLufs = lufsPromise;

    // Await the lufs
    return lufsPromise;
}

var SpotifyAnalyser = ({ track, setTrackGainModifiers, ...props }) => {
    var updateGain = (normalizationGain) => {
        if (track) {
            //  track.gainNode.gain.value += track.gainModifiers.reduce((a, b) => a + b, 0);
            setTrackGainModifiers((trackGainModifiers) => {
                return {
                    ...trackGainModifiers,
                    Normalization: normalizationGain,
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
    var [loading, setLoading] = useState(false);
    var [error, setError] = useState(null);
    var [lufs, setLufs] = useState(null);
    var [gain, setGain] = useState(false);
    var [forceGain, setForceGain] = useState(false);

    useEffect(() => {
        if (track && forceGain) {
            setLoading(true);
            setError(null);
            setLufs(null);
            setGain(false);
            updateGain(0);

            (async () => {
                try {
                    await new Promise((resolve, reject) => {
                        setTimeout(() => {
                            resolve();
                        }, 0);
                    });

                    // Use exportAudioBuffer to get the LUFS
                    // Arraybuffer with applied input gain (dbs in volume)
                    var arrayBuffer = track.audioData;

                    // Store in localStorage based on hash of blob
                    // Since the new arrayBuffer is directly dependant on the volume, we can bypass the need to store the arrayBuffer itself by storing the hash of the arrayBuffer and the volume
                    var hash = await arrayBufferToHash(arrayBuffer) + track.gainNode.gain.value;

                    // Check if the hash exists in localStorage
                    var lufs = localStorage.getItem('hash_lufs_' + hash);
                    if (0 && lufs) {
                        console.log('Obtaining LUFS for arrayBuffer from localStorage', arrayBuffer);
                        setLufs(lufs);
                        setLoading(false);

                        if (updateGain) {
                            // Use lufs to calculate gain reduction for spotify (-14 LUFS)
                            var gainReduction = -14 - lufs;

                            // Update the gain
                            updateGain(gainReduction);
                        }
                        return;
                    } else {
                        console.log('Obtaining LUFS for arrayBuffer', arrayBuffer);
                        var lufs = await getLufs(track, arrayBuffer);

                        // Use lufs to calculate gain reduction for spotify (-14 LUFS)
                        console.log('lufs', lufs);
                        var gainReduction = -14 - lufs;

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
        } else {
            updateGain(0);
        }
    }, [track, forceGain]);

    // Store gain value in localStorage so we can figure out the highest gain value later
    useEffect(() => {
        if (gain) {
            window.tracks[track.index].gain = gain;

            // Unique
            var uniqueGains = [...new Set(window.tracks.map((track) => track.gain).filter((gain) => gain))];

            console.log('uniqueGains', uniqueGains);

            // Get the gain with the lowest value
            var highestGain = Math.max(...uniqueGains);

            console.log('uniqueGains', highestGain);

            // Store highestGain and the current gain in window
            window.highestGain = highestGain;
        }

    }, [gain, track]);

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 55 + '%',
            }}
        >

            <legend
                className={"spotify-normalization " + ((forceGain && !loading) ? 'active ' : '') + (loading ? 'loading ' : '') + (error ? 'error ' : '')}
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
                    //setLufs(null);
                    //setGain(false);
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
                {gain && <div>Loud.penalty: {(gain + 14).toFixed(2)}</div>}
                {gain && <div>Gain: {gain.toFixed(2)}</div>}
            </legend>
        </div>
    );
};

export default React.memo(SpotifyAnalyser);