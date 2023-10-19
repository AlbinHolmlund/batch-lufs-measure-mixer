import React, { useRef, useState, useEffect, useMemo, useLayoutEffect } from 'react';
import Color from 'color';
//  import { createPortal } from 'react-dom';
import styled from 'styled-components';
// Framer motion
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@mui/material/Button';
import ReactNbsp from 'react-nbsp'

import toWav from 'audiobuffer-to-wav';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { LoudnessMeter } from '@domchristie/needles';
import { useLanguage } from './useLanguage';

import AudioVisualizer from './AudioVisualizer.';
import useLocalStorageState from './useLocalStorageState';

import SpotifyAnalyser from './SpotifyAnalyser';

const confirmation = (message) => {
	// Trim tabs
	message = message.replace(/\t/g, '');
	return window.confirm(message);
}

const closest = (el, selector) => {
	// Walk up the DOM tree until we find a node that matches the selector or we reach the top
	while (el) {
		if (el.matches(selector)) {
			return el;
		}
		el = el.parentElement;
	}
	return null;
};

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

const calculateZoomLevel = () => {
	let val = window.innerWidth / (770 / 0.7);
	let min = 0.8;
	let max = 1.1;
	return Math.min(Math.max(val, min), max);
}

const useCardsZoomLevel = () => {
	// Zoom is either localStorage.getItem('cards-zoom-level') or if the value isn't set it will instead calculate its zoom value based on the width (0.7 at 770px width)
	const [zoomLevel, setZoomLevel] = useState(() => {
		const zoomLevel = window.localStorage.getItem('cardsZoomLevel');
		if (zoomLevel) {
			return parseFloat(zoomLevel);
		} else {
			return calculateZoomLevel();
		}
	});

	useEffect(() => {
		/* 
			Update zoom level when:
			- window is resized
			- zoom level localStorage value is changed
		*/
		const onResize = () => {
			const zoomLevel = window.localStorage.getItem('cardsZoomLevel');
			if (zoomLevel) {
				setZoomLevel(parseFloat(zoomLevel));
			} else {
				setZoomLevel(calculateZoomLevel());
			}
		};
		window.addEventListener('resize', onResize);
		window.addEventListener('storage', onResize);
		return () => {
			window.removeEventListener('resize', onResize);
			window.removeEventListener('storage', onResize);
		}
	}, []);

	return zoomLevel;
}

const MixerTrack = styled(({ className, children, ...props }) => {
	const cardsZoomLevel = useCardsZoomLevel();
	return (
		<motion.div
			// Make draggable
			// drag dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
			// dragElastic={0.1}
			// dragMomentum={false}
			className={'mixer-track ' + className}
			{...props}
			style={{
				zoom: cardsZoomLevel
			}}
		>
			{children}
		</motion.div>
	);
})`
	position: relative;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	border: 4px solid currentColor;
	border-radius: 10px;
	margin: 10px;
	color: #000;
	background-color: #fff;
	transition: all 0.2s ease-in-out;
	
	min-height: 100%;
	flex: 1 1 auto 100%;

	&:hover{
		box-shadow: 0 0 0 2px rgba(255,255,255,0.5);
	}
	/*&:focus, &:focus-within, &.active{
		box-shadow: 0 0 0 4px #fff !important;
	}*/
	&.active{
		
		box-shadow: 0 0 0 4px lime !important;
	}

	button{
		margin: 5px;
		background-color: #0a1929;
		color: #fff;
		cursor: pointer;

		&:hover{
			background-color: #0a1929;
			color: #fff;
		}
	}
`;

const PlaceholderMixerTrack = styled(MixerTrack)`
	pointer-events: none;
	opacity: 0.25;
`;

const MultilinePart = ({ children, topRef, onIsMultiLineChange, index, ...props }) => {
	// Compare top offset of this compared to last topRef.current (if not null) and set isMultiLine accordingly
	const ref = useRef(null);

	useEffect(() => {
		console.log(topRef.current);
		if (topRef.current && (topRef.current != 'found')) {
			const isMultiLine = ref.current.offsetTop !== topRef.current.offsetTop;
			if (isMultiLine) {
				topRef.current = 'found';
				onIsMultiLineChange(isMultiLine ? index : false);
			}
		}
		if (topRef.current != 'found') {
			topRef.current = ref.current;
		}
	}, [children, topRef, onIsMultiLineChange]);

	return (
		<span ref={ref} {...props}>
			{children}
		</span>
	);
};

const LabelEllipsis = ({ text, ...props }) => {
	const topRef = useRef(null);
	const [isMultiLine, setIsMultiLine] = useState(false);

	console.log('isMultiLine', isMultiLine);

	const ellipsisEnd = useMemo(() => {
		topRef.current = null;
		const childrenSpans = text.split(' ').map((word, i) => (
			<MultilinePart
				key={i + '_' + word}
				index={i}
				topRef={topRef}
				onIsMultiLineChange={setIsMultiLine}
			>
				{word + ' '}
			</MultilinePart>
		));
		return (
			<span
				style={{
					whiteSpace: isMultiLine ? 'nowrap' : '',
					overflow: 'hidden',
					textOverflow: 'ellipsis',
					display: 'block'
				}}
			>
				{childrenSpans}
			</span>
		);
	}, [text, isMultiLine]);

	const ellipsisStart = useMemo(() => {
		if (!isMultiLine) {
			return null;
		}
		// Build span list starting from isMultiLine (index)
		const childrenSpans = text.split(' ').slice(isMultiLine - 1).map((word, i) => (
			<span
				key={i + '_' + word}
				style={{
					direction: 'ltr',
					display: 'inline-block'
				}}
			>
				{word}<ReactNbsp />
			</span>
		)).reverse();
		return (
			<span
				style={{
					whiteSpace: 'nowrap',
					overflow: 'hidden',
					textOverflow: 'ellipsis',
					display: 'block',
					direction: 'rtl'
				}}
			>
				{childrenSpans}
			</span>
		);
	}, [text, isMultiLine]);

	return (
		<div {...props} title={text}>
			{ellipsisEnd}
			{ellipsisStart}
		</div>
	);
}

const MixerTrackName = styled(LabelEllipsis)`
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

const MixerTrackVolumeSlider = styled(({ file, className, onChange, children, volumeDependantChildren, ...props }) => {
	const [volumeInDB, setVolumeInDB] = useLocalStorageState((file && file.name || 'none') + '_volume', 0);
	const [volumeInDBTemp, setVolumeInDBTemp] = useState(0);
	const [trackGainModifiers, setTrackGainModifiers] = useLocalStorageState((file && file.name || 'none') + '_trackGainModifiers', {});

	useEffect(() => {
		if (!volumeInDB || isNaN(volumeInDB)) {
			setVolumeInDB(0);
		}
	}, [volumeInDB]);

	useEffect(() => {
		onChange && onChange(
			Object.values(trackGainModifiers).reduce((a, b) => a + b, volumeInDB)
		);
	}, [volumeInDB, onChange, trackGainModifiers]);

	useEffect(() => {
		setVolumeInDBTemp(volumeInDB);
	}, [volumeInDB]);


	useEffect(() => {
		// Listen for the highestGain event
		const listener = async (e) => {
			// Reset counter
			// localStorage.setItem('gains-received-counted', 0);

			// Call the undo gain event and wait for it to finish
			window.dispatchEvent(new CustomEvent('audio-mixer-undo-all-gains'));

			await new Promise((resolve) => {
				requestAnimationFrame(() => {
					resolve();
				});
			});

			// Make sure that there isnt any tracks that isnt normalized yet
			await new Promise((resolve) => {
				[...document.querySelectorAll('.spotify-normalization:not(.active)')].forEach(node => node.click());

				const interval = setInterval(() => {
					if ([...document.querySelectorAll('.spotify-normalization:not(.active)')].length === 0) {
						console.log('done');
						clearInterval(interval);
						resolve();
					}
				}, 20);
			});

			// Read counter
			// const gainsReceivedCounted = parseInt(localStorage.getItem('gains-received-counted'));
			// console.log('gainsReceivedCounted', gainsReceivedCounted);

			// Undo normalization
			// [...document.querySelectorAll('.spotify-normalization.active')].forEach(node => node.click());

			// updateGain(gainDifference);
			setTimeout(async () => {
				// Read what the highest gain is
				// const { highestGain } = e.detail;
				// console.log('highestGain2', highestGain)

				const highestGain = window.highestGain;

				// Do the gain calculation

				// Calc8lagte diference between highest gain and current gain
				let gainDifference = window.tracks[file.index].gain - highestGain;
				gainDifference = Math.round(gainDifference * 10) / 10;

				console.log('file', file);

				// Update gain
				console.log('gainDifference', gainDifference)

				setVolumeInDB(gainDifference || 0);
				setVolumeInDBTemp(gainDifference || 0);
			}, 1);
		}
		window.addEventListener('auto-gain', listener);
		return () => {
			window.removeEventListener('auto-gain', listener);
		};
	}, []);

	useEffect(() => {
		// Listen for window audio-mixer-undo-all-gains event
		const listener = (e) => {
			setVolumeInDB(0);
			setVolumeInDBTemp(0);
		};
		window.addEventListener('audio-mixer-undo-all-gains', listener);
		return () => {
			window.removeEventListener('audio-mixer-undo-all-gains', listener);
		};
	}, []);

	return (
		<div className={className}>
			{children}
			{volumeDependantChildren && volumeDependantChildren({
				volumeInDB,
				setVolumeInDB,
				setTrackGainModifiers,
			})}
			<input
				type="range"
				orient="vertical"
				step="0.1"
				min="-5"
				max="5"
				style={{
					display: 'block',
					margin: '10px auto'
				}}
				onChange={(e) => {
					let volumeInDB = parseFloat(e.target.value);

					if (!volumeInDB || isNaN(volumeInDB)) {
						volumeInDB = 0;
					} else if (volumeInDB > 5 && !window.confirm('Are you sure you want to set the volume to more than 5 dB, it can be very loud?')) {
						volumeInDB = 0;
					}

					setVolumeInDB(volumeInDB);
				}}
				onDoubleClick={() => {
					setVolumeInDB(0);
				}}
				value={volumeInDB}
			/>
			<input
				type="number"
				value={`${volumeInDBTemp}`}
				onChange={(e) => {
					let volumeInDB = e.target.value;

					setVolumeInDBTemp(volumeInDB);
				}}
				onBlur={(e) => {
					let volumeInDB = parseFloat(e.target.value);

					if (volumeInDB > 5 && !window.confirm('Are you sure you want to set the volume to more than 5 dB, it can be very loud?')) {
						volumeInDB = 0;
					}

					setVolumeInDB(volumeInDB);
				}}
			/>
			<div>{
				volumeInDB > 0 ? `+${volumeInDB} dB` : `${volumeInDB} dB`
			}</div>
			<div style={{
				fontSize: '0.5em',
			}}>
				{Object.keys(trackGainModifiers).map((key) => (
					<div key={key}>
						{key}: {trackGainModifiers[key]} dB
					</div>
				))}
			</div>
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
	// Lock to 1 decimal
	// Example: 1.0, 0.5, 0.0, -0.5, -1.0, 7.6
	return (Math.round(lufs * 10) / 10).toFixed(1);
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
				workerUri: window.PUBLIC_URL + '/needles-worker.js'
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
			<legend style={{
				color: getLoudnessColor(shortTerm),
				backgroundClip: 'text'
			}}>
				<span>Short Term</span>
				{formatLufs(shortTerm)}
			</legend>
			<legend style={{
				color: getLoudnessColor(momentary),
				backgroundClip: 'text'
			}}>
				<span>Momentary</span>
				{formatLufs(momentary)}
			</legend>
			<legend style={{
				color: getLoudnessColor(integrated),
				backgroundClip: 'text'
			}}>
				<span>Integrated</span>
				{formatLufs(integrated)}
			</legend>
		</div>
	);
};

const getLoudnessColor = (lufs) => {
	// At -14 LUFS normal green
	// The further away from -14 red it gets, maximum at -5 and 5 (-19 and -9)
	// The closer to -14 the more green it gets
	const color = Color('#1DB954');
	const diff = Math.abs(lufs - -14);
	const maxDiff = 9;
	const maxColor = Color('#b91d47');
	const maxColorDiff = 5;
	const diffPercentage = diff / maxDiff;
	const colorDiffPercentage = diffPercentage * maxColorDiff;
	const newColor = color.mix(maxColor, colorDiffPercentage);
	return newColor.toString();
}

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

const decodeAudioData = (arrayBuffer, audioCtx) => {
	return new Promise((resolve, reject) => {
		audioCtx.decodeAudioData(arrayBuffer.slice(0), function (buffer) {
			resolve(buffer);
		}, function (e) {
			reject(e);
		});
	});
};

const exportAudioBuffer = async (arrayBuffer, fileName, volumeInDB, returnValue) => {
	// Create a new offline context
	const audioCtx = new AudioContext();

	// Decode the audio data
	const audioBuffer = await decodeAudioData(arrayBuffer, audioCtx);

	console.log('exportAudioBuffer', audioBuffer);

	let offlineCtx = new OfflineAudioContext(
		audioBuffer.numberOfChannels, // 2
		audioBuffer.duration * audioBuffer.sampleRate, // 44100
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
const AudioMixer = ({ files, audioContext, otherTools }) => {
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
					try {
						const gainNode = audioContext.createGain();

						// Apply the file data to a new audio dom element and then connect it to the gain node
						// file.dataUrl
						const audio = document.createElement('audio');
						audio.controls = true;
						audio.loop = true;
						audio.autoplay = true;
						audio.muted = true;

						// Add source
						const source = document.createElement('source');
						source.src = file.dataUri;
						source.type = 'audio/wav';

						audio.appendChild(source);

						const audioSource = audioContext.createMediaElementSource(audio);
						audioSource.connect(gainNode);

						// Connect gainNode to a special node that we will use to mute the track
						const muteNode = audioContext.createGain();
						muteNode.gain.value = 0; // 0 = muted, 1 = unmuted
						gainNode.connect(muteNode);

						// Connect the mute node to the audio context destination
						muteNode.connect(audioContext.target || audioContext.destination);

						return {
							index,
							name: file.name,
							// Cloned buffer data
							audioData: file.data,
							// audioBuffer: await audioContext.decodeAudioData(file.data),
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
					} catch (e) {
						console.log('error', e);
					}

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
						window.tracks = tracks;
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
			/*activeTrackRef.current.muteNode.disconnect();
			activeTrackRef.current = null;*/
			activeTrackRef.current.mute();
			closest(activeTrackRef.current.audio, '.mixer-track').classList.remove('active');
		}

		// Connect
		// track.muteNode.connect(audioContext.destination);
		track.unmute();
		// Play if not playing
		if (track.audio.paused) {
			track.audio.play();
		}

		// Set the active track ref
		activeTrackRef.current = track;

		closest(track.audio, '.mixer-track').classList.add('active');

		// Set analyser node to this
		// analyserNode.current = track.gainNode;
	}

	const handleStop = (track) => {
		// Disconnect
		// track.muteNode.disconnect();
		track.mute();
		closest(track.audio, '.mixer-track').classList.remove('active');

		// Set the active track ref
		activeTrackRef.current = null;
	}

	return (
		<>
			<div>
				<AudioVisualizer
					audioContext={audioContext}
				/>

				{tracks && tracks.length ? (
					<>
						<Button
							onClick={() => {
								// Export all
								setHighPerfMode(true);
								(async () => {
									var zip = new JSZip();
									var blobs = await Promise.all(tracks.map((track) => {
										// Based track.audioData
										const audioBuffer = track.audioData;
										return exportAudioBuffer(audioBuffer, track.name, track.gainNode.gain.value, true);
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

						<Button
							style={{
								// Spotify green
								// color: '#1DB954',
								// filter: 'brightness(1.5)',
								// Make color 50% brighter
								color: Color('#1DB954').lighten(0.5).toString(),
							}}
							onClick={() => {
								(async () => {
									window.dispatchEvent(new CustomEvent('audio-mixer-undo-all-gains'));

									await new Promise((resolve) => {
										requestAnimationFrame(() => {
											resolve();
										});
									});

									[...document.querySelectorAll('.spotify-normalization.active')].forEach(node => node.click());

									await new Promise((resolve) => {
										requestAnimationFrame(() => {
											resolve();
										});
									});

									[...document.querySelectorAll('.spotify-normalization:not(.active)')].forEach(node => node.click());

									[...document.querySelectorAll('.hidden.button')].forEach(node => node.classList.remove('hidden'));
								})();
							}}
						>
							{__('Normalize all tracks')}
						</Button>

						<Button
							style={{
								color: '#fff',
								opacity: 0.5
							}}
							onClick={() => {
								window.dispatchEvent(new CustomEvent('audio-mixer-undo-all-gains'));
							}}
						>
							{__('Undo all volume changes (beta)')}
						</Button>

						{otherTools}
					</>
				) : null}
			</div>
			<div>
				<Button
					style={{
						// Color is a golden dark yellow
						color: '#f5d742',
					}}
					onClick={() => {
						// Give yes or no option with some more info

						if (!confirmation(__(`Are you sure you want to make all volumes even?
						Things to consider:

						1. This is an experimental feature and may not work as expected. 
						
						2. It will also remove any volume changes you have made manually on your tracks.
						
						3. It will turn off spotify normalization for all tracks as well.`))) {
							return;
						}
						alert('Okay! Turning on spotify normalization on all tracks. Once it is finished, the volumes will be evened out.');
						window.dispatchEvent(new CustomEvent('auto-gain'));
					}}
				>
					{__('Equalize track volumes (Extremely beta but magical) ✨')}
				</Button>
			</div >
			<MixerContainer>
				{tracks && tracks.map((track, index) => {
					if (!track) {
						return (
							<PlaceholderMixerTrack key={index}>
								<MixerTrackName text={__('Loading...')} />
								<MixerTrackVolume>
									<MixerTrackVolumeSlider />
								</MixerTrackVolume>
								<Button
									size="small"
								>
									{__('Export')}
								</Button>
								<div>
									<audio controls />
								</div>
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
							className={activeTrackRef.current === track ? 'box active' : 'box'}
							onFocus={() => {
								if (activeTrackRef.current !== track) {
									handlePlay(track);
								}
							}}
							onDoubleClick={() => {
								if (activeTrackRef.current === track) {
									handleStop(track);
								} else {
									handlePlay(track);
								}
								// Blur actively focused element
								document.activeElement.blur();
							}}
							onBlur={() => {
								if (localStorage.getItem('keepFocus') === 'true') {
									return;
								}
								if (activeTrackRef.current === track) {
									handleStop(track);
								}
							}}
						>
							<MixerTrackName text={track.name} />
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
									volumeDependantChildren={({ volumeInDB, setTrackGainModifiers }) => {
										return (
											!highPerfMode && (
												<SpotifyAnalyser
													track={track}
													setTrackGainModifiers={setTrackGainModifiers}
												/>
											)
										);
									}}
								>
									{!highPerfMode && (
										<MixerTrackAnalyzer
											gainNode={track.gainNode}
										/>
									)}
								</MixerTrackVolumeSlider>

								<Button
									size="small"
									onClick={() => {
										// Export the audio buffer
										const audioBuffer = track.audioData;
										exportAudioBuffer(audioBuffer, track.name, track.gainNode.gain.value);
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

										// Play if not playing
										if (track.audio.paused) {
											track.audio.play();
										}

										// On next mouse or touch event, unmute 
										const unmute = () => {
											track.audio.muted = false;

											document.removeEventListener('mousedown', unmute);
											document.removeEventListener('touchstart', unmute);
											document.removeEventListener('mousemove', unmute);
										};
										document.addEventListener('mousedown', unmute);
										document.addEventListener('touchstart', unmute);
										document.addEventListener('mousemove', unmute);


										return () => {
											console.log('unmounting', el);
											track.audio.remove();
										}
									}}
								>

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