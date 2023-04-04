import React, { useRef, useEffect, useState, useLayoutEffect, useMemo } from "react";
import { useAmplifier, useNormalization } from "./hooks";
import * as d3 from "d3";
import { motion } from "framer-motion";

const comparePrecision = 4;
const precision = 2;

const useTransition = (value, divider) => {
    // Value is an array of values
    const valueRef = useRef(value);
    const [transitionValue, setTransitionValue] = useState(value);
    const transitionValueRef = useRef(transitionValue);

    useEffect(() => {
        valueRef.current = value;
    }, [value]);

    useEffect(() => {
        transitionValueRef.current = transitionValue || 0;
    }, [transitionValue]);

    useEffect(() => {
        requestAnimationFrame(() => {
            if (typeof value === "undefined") {
                return;
            }

            if (Array.isArray(valueRef.current)) {
                let changed = false;
                const newValue = (valueRef.current || []).map((value, i) => {
                    const oldValue = transitionValueRef.current[i] || 0;
                    const v = value || 0;
                    let newVal = oldValue + ((v - oldValue) / divider);
                    // Check  diff  betgween old and new
                    if ((typeof transitionValueRef.current[i] === 'undefined') || (newVal.toFixed(comparePrecision) !== oldValue.toFixed(comparePrecision))) {
                        changed = true;
                    }

                    return newVal;
                });
                if (changed) {
                    setTransitionValue(newValue);
                }
            } else {
                const oldValue = transitionValueRef.current || 0;
                const newValue = oldValue + ((valueRef.current - oldValue) / divider);

                if (newValue.toFixed(comparePrecision) === oldValue.toFixed(comparePrecision)) {
                    return;
                }

                setTransitionValue(newValue);
            }
        });
    }, [value, transitionValue, divider]);

    return Array.isArray(transitionValue) ? transitionValue.map((v) => parseFloat(v.toFixed(precision))) : parseFloat(transitionValue.toFixed(precision));
};

const Icon = ({
    bass,
    midToHigh: midToHighUnnormalized,
    style,
    ...props
}) => {
    // Path reference
    const pathRef1 = useRef();
    const pathRef2 = useRef();
    const pathRef3 = useRef();

    // Nomalize each mid to high value to a value between 0 and 1 based on a rolling window and compare it to min and max

    const midToHighValue = useNormalization((midToHighUnnormalized), 25);
    const midToHigh = useTransition(midToHighValue, 2);

    const offsetMidToHigh = useMemo(() => {
        return Array.isArray(midToHighUnnormalized) && !midToHighUnnormalized.some((v) => v !== 0) ? 1 : 0;
    }, [midToHighUnnormalized]);

    const offsetMidToHighValue = useTransition(offsetMidToHigh, 10);


    // Amplify the bass
    const amplifiedBass = useAmplifier(bass || 0, 4, 13);

    // Normalize the bass to a value between 0 and 1
    const bassNormalized = useTransition(offsetMidToHigh === 1 ? 0.8 : amplifiedBass, 2);

    const bassValue = 0.3 + (bassNormalized * 0.7);

    //console.log("offsetMidToHigh", midToHigh, offsetMidToHighValue, Date.now());

    // Scale the icon based on the bass
    // bassValue  is between -1 and 1 and we want scale to range from 0.7 to 1
    const scale = Math.min(Math.max(0.6 + (bassValue * 0.4), 0.6), 1);
    const translateX = 12;
    const translateY = 12;

    // Use D3 to create the path
    useLayoutEffect(() => {
        if (!pathRef1.current || !pathRef2.current || !pathRef3.current) {
            return;
        }

        // d={`M18.527 10.018c-1.311 0-1.23 2.552-1.848 3.708a.249.249 0 01-.456-.04c-.702-2.153-.382-7.386-2.287-7.386-1.994 0-1.501 6.771-2.277 9.53-.058.21-.347.229-.432.026-.82-1.968-.728-6.263-2.28-6.263-1.605 0-1.468 3.598-2.097 5.047a.247.247 0 01-.449.01c-.458-.956-.605-2.884-2.336-2.884H2.05a.455.455 0 000 .91h2.016c1.432 0 .946 3.175 2.6 3.175 1.535 0 1.369-3.453 2.026-4.983a.23.23 0 01.424.005c.734 1.865.72 6.359 2.406 6.359 1.892 0 1.218-7.157 2.226-9.676a.237.237 0 01.436-.011c.938 2.05.444 7.403 2.136 7.403 1.493 0 1.582-2.465 2.031-3.679a.236.236 0 01.432-.024c.47.912.77 2.343 2.187 2.343h2.036a.455.455 0 000-.91h-2.036c-1.206 0-1.018-2.66-2.442-2.66z`}

        let ogLineCoords = [
            0, // 0,
            0, // 1,
            // The actual frequency data starts here
            -0.6, // 0, 2
            0.5, // 1, 3
            -1, // 2, 4
            1, // 3, 5
            -0.6, // 4, 6
            0.5, // 5, 7
            // The actual frequency data ends here
            0, // 6, 8
            0 // 7, 9                   
        ];

        // Lets just even out the line instead for now
        Object.keys(ogLineCoords).forEach((key) => {
            //ogLineCoords[key] = 0;
        });

        // Since i measured the points in comparison to the biggest value, i need to multiply them by how much the biggest value is scaled, i think its about 1/4 of the full height
        const multip = 24 / 2;

        Object.keys(ogLineCoords).forEach((key) => {
            ogLineCoords[key] = ogLineCoords[key] * multip;
        });

        // const startCoords = [18.527, 10.018];
        // const endCoords = [2.05, 10.018];

        const width = 24;
        // const height = 24;

        // Start 10% from the left and end 10% from the right
        const startX = width * 0.1;
        const endX = width * 0.9;

        // Create the line
        const line = d3
            .line()
            // Use the frequency data to determine the x and y coordinates
            // XXX: This is a bit hacky, but it works
            .x((d, i) => {
                const x = startX + (endX - startX) * (i / (midToHigh.length - 1));
                return x;
            })
            .y((d, i) => {
                const y = ogLineCoords[i];
                /* var y = ogLineCoords[i];
                 y = (d - 0.5) * (i % 2 === 0 ? 1 : -1);
                 return 12 - (y * 4);*/
                return (12 - (y * d));
            })
            // Curve
            .curve(d3.curveBasis);

        // Create the path
        const applyPath = (pathRef) => {
            return d3.select(pathRef.current)
                // .datum(hasData ? midToHigh : Array(midToHigh.length).fill(1))
                .datum(midToHigh.map((v, index) => {
                    return (v + offsetMidToHighValue) / 2;
                }))
                .attr("d", line)
                .attr("stroke-width", "0.7")
                // Runded corners
                .attr("stroke-linecap", "round")
                // Smooth the line
                .attr("stroke-linejoin", "round");
        };

        applyPath(pathRef1);
        applyPath(pathRef2);
        applyPath(pathRef3);
    }, [midToHigh, offsetMidToHighValue, pathRef1, pathRef2, pathRef3]);


    return (
        <motion.div
            className="svg-container"
            // Animate in animatePresence
            style={{
                display: "inline-block"
            }}
            {...props}
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="24"
                height="24"
                // Keep ratio
                preserveAspectRatio="xMidYMid meet"
                style={{
                    width: "300px",
                    height: "300px",
                    ...(style || {}),
                }}
            >

                <defs>
                    <linearGradient id="svg_6" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0" stopColor="#00bfbf"></stop>
                        <stop offset="1" stopColor="#f0f" stopOpacity="0.996"></stop>
                    </linearGradient>
                    <linearGradient id="svg_11" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0" stopColor="#90a" stopOpacity="0.996"></stop>
                        <stop offset="1" stopColor="#0ff"></stop>
                    </linearGradient>
                </defs>
                <g
                    // Scale the icon based on the bass
                    transform={scale ? `
                        translate(${translateX}, ${translateY}) 
                        scale(${scale})
                        translate(${-translateX}, ${-translateY})
                    ` : ""}
                >
                    <ellipse
                        cx="12.029"
                        cy="12.067"
                        fill="#fff"
                        rx="9.398"
                        ry="9.574"
                    ></ellipse>
                    <ellipse
                        cx="12"
                        cy="12.616"
                        fill="url(#svg_11)"
                        fillOpacity="0.39"
                        rx="9.047"
                        ry="8.542"
                        transform="rotate(-180 12 12.616)"
                    ></ellipse>
                    <path
                        fill="url(#svg_11)"
                        d="M12 22.007c-5.517 0-10.007-4.49-10.007-10.007S6.483 1.993 12 1.993 22.007 6.483 22.007 12 17.517 22.007 12 22.007zM12 4.1c-4.646 0-8.427 3.78-8.427 8.427s3.78 8.426 8.427 8.426 8.427-3.78 8.427-8.426S16.647 4.1 12 4.1z"
                    ></path>
                </g>
                <g>
                    <path
                        stroke="#e5e5e5"
                        fill="none"
                        transform="translate(-0.5, -0.5)"
                        ref={pathRef1}
                    />
                    <path
                        stroke="#c9c9c9"
                        fill="none"
                        transform="translate(0.5, -0.5)"
                        ref={pathRef2}
                    />
                    <path
                        // fill="url(#svg_6)"
                        stroke="#a305ff"
                        // stroke="url(#svg_6)"
                        fill="none"
                        ref={pathRef3}
                    ></path>
                </g>
            </svg>
        </motion.div>
    );
};

export default Icon;