import React, { useEffect, useState } from 'react';
import LogoVisualizer from './LogoVisualizer';

const AudioVisualizer = ({ audioContext, ...props }) => {
    // To test reading the data we start by just outputting text info about the different frequencies

    const [analyser, setAnalyser] = useState(null);
    const [bufferLength, setBufferLength] = useState(null);
    const [dataArray, setDataArray] = useState(null);
    const [showVisualizer, setShowVisualizer] = useState(true);
    const [data, setData] = useState({});

    useEffect(() => {
        if (!audioContext) {
            return;
        }

        // audioContext is a cccontinuous stream of audio data
        // We need to create an analyser to get the data
        const analyser = audioContext.createAnalyser();
        setAnalyser(analyser);

        const bufferLength = analyser.frequencyBinCount;
        setBufferLength(bufferLength);

        const dataArray = new Uint8Array(bufferLength);
        setDataArray(dataArray);
    }, [audioContext]);

    useEffect(() => {
        if (!analyser || !audioContext) {
            return;
        }

        // Connect the analyser to the audioContext
        if (!showVisualizer) {
            analyser.disconnect();
            audioContext.target = audioContext;
            return;
        }

        audioContext.target = analyser;
        analyser.connect(audioContext.destination);

        // Draw the data
        var frame;
        const draw = () => {
            // Log the data
            setData((data) => {
                // Get the data
                analyser.getByteFrequencyData(dataArray);

                // Draw the data
                // Log bass, mid, and treble
                const bass = dataArray.slice(0, 32).reduce((a, b) => a + b);

                // Noramlize the data
                const bassMax = 32 * 255;
                const bassNormalized = bass / bassMax;

                const mid = dataArray.slice(32, 64).reduce((a, b) => a + b);

                const treble = dataArray.slice(64, 128).reduce((a, b) => a + b);

                return {
                    ...data,
                    bass,
                    mid,
                    treble,
                    bassNormalized,
                };
            });

            // Draw the data

            frame = requestAnimationFrame(draw);
        }

        draw();

        return () => {
            analyser.disconnect();
            cancelAnimationFrame(frame);
        };
    }, [analyser, audioContext]);

    return (
        <div>
            <h1>Audio Visualizer</h1>
            <div>
                <label>
                    <input
                        type="checkbox"
                        checked={showVisualizer}
                        onChange={(e) => setShowVisualizer(e.target.checked)}
                    />
                    Show Visualizer
                </label>

                <div>
                    <h2>Audio Data</h2>
                    <div>wwwww
                        <div>
                            <label>Bass</label>
                            <div
                                style={{
                                    // Based on  bassVelocity
                                    transform: `
                                        scale(${(data.bassNormalized - 0.5) * 10}, 1)
                                    `,
                                    transition: 'transform 0.05s',
                                }}
                            >{
                                    data.bass
                                }</div>
                        </div>
                        <div>
                            <label>Mid</label>
                            <div>{data.mid}</div>
                        </div>
                        <div>
                            <label>Treble</label>
                            <div>{data.treble}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

    );
}

export default AudioVisualizer;                 
