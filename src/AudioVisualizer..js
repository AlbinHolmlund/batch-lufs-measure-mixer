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

                /*const mid = dataArray.slice(32, 64).reduce((a, b) => a + b);
                const treble = dataArray.slice(64, 128).reduce((a, b) => a + b);*/

                // We use 5 bands of data for mid to high frequencies
                // So midToHigh is an array of 5 values
                const midToHigh = [];
                midToHigh.push(0);
                midToHigh.push(0);
                for (let i = 0; i < 6; i++) {
                    const start = 32 + i * 32;
                    const end = start + 32;
                    const sum = dataArray.slice(start, end).reduce((a, b) => a + b);
                    midToHigh.push(sum);
                }
                midToHigh.push(0);
                midToHigh.push(0);

                // Normalized midToHigh
                const midToHighMax = 32 * 255;
                const midToHighNormalized = midToHigh.map((v) => v / midToHighMax);

                // console.log('midToHigh', midToHighNormalized);

                return {
                    ...data,
                    bass,
                    midToHigh: midToHighNormalized,
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

                <LogoVisualizer
                    bass={data.bassNormalized}
                    midToHigh={data.midToHigh}
                />
            </div>
        </div>
    );
}

export default AudioVisualizer;                 
