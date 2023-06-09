import React, { useEffect, useState, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LogoVisualizer from './LogoVisualizer';
import equal from 'fast-deep-equal';
import { Context } from './Context';
import useLocalStorage from './useLocalStorageState';

const AudioVisualizer = ({ audioContext, ...props }) => {
    const ctx = useContext(Context);

    // To test reading the data we start by just outputting text info about the different frequencies

    const [analyser, setAnalyser] = useState(null);
    const [bufferLength, setBufferLength] = useState(null);
    const [dataArray, setDataArray] = useState(null);

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

        audioContext.target = analyser;
        analyser.connect(audioContext.destination);

        if (!ctx?.data?.showVisualizer) {
            return;
        }

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
                const bassNormalized = bass; // / bassMax;

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

                let newObject = {
                    ...data,
                    bass: Math.round(bass),
                    midToHigh: midToHighNormalized.map((v) => Math.round(v * 100) / 100),
                    bassNormalized: Math.round(bassNormalized * 100) / 100,
                };

                // Compare the new data to the old data
                // If the data is the same, don't update the state
                // This prevents the component from re-rendering

                return equal(data, newObject) ? data : newObject;
            });

            // Draw the data

            frame = requestAnimationFrame(draw);
        }

        draw();

        return () => {
            analyser.disconnect();
            cancelAnimationFrame(frame);
        };
    }, [analyser, audioContext, ctx?.data?.showVisualizer]);

    return (
        <div>
            <AnimatePresence>
                {ctx?.data?.showVisualizer && (
                    <motion.div
                        key="logo-visualizer-container"
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <LogoVisualizer
                            key="logo-visualizer"
                            layoutId="logo-visualizer"
                            layout
                            bass={data.bassNormalized}
                            midToHigh={data.midToHigh}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default AudioVisualizer;                 
