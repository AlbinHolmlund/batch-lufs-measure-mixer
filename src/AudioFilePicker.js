import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import AudioMixer from './AudioMixer';
import { cacheFiles } from './FileCache';

let FileInputArea = ({ className, onChange, ...props }) => {
    return (
        <div className={className}  {...props}>
            <input type="file" multiple onChange={onChange} />
            <div className="message">
                <p>Click here to select audio files</p>
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

// Multifile picker, with audio file type filter
const AudioFilePicker = () => {
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
                    });
                }
                reader.onerror = reject;
            });
        });

        (async () => {
            // Cache the files
            const files = await Promise.all(filesAsDataUri);
            const urls = await cacheFiles(files.map((file) => {
                return {
                    name: file.name,
                    dataUri: file.dataUri
                };
            }))
            console.log('done', urls);
            // Save in localStorage
            localStorage.setItem('files', JSON.stringify(urls));
        })();

        // Set the files state
        /*Promise.all(filesAsDataUri).then((files) => {
            setFiles(files);
        });*/

        // Async test
        setFiles(filesAsDataUri);
    }

    useEffect(() => {
        if (localStorage.getItem('files')) {
            const urls = JSON.parse(localStorage.getItem('files'));

            if (!audioContext) {
                // Create audio context
                const audioContext = new AudioContext();
                setAudioContext(audioContext);
            }

            // Read the files as data uri
            const filesAsDataUri = urls.map((url) => {
                return new Promise((resolve, reject) => {
                    // Read as array buffer
                    fetch('/' + url).then((response) => response.arrayBuffer()).then((response) => {
                        console.log(url, URL.createObjectURL(new Blob([response])));
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
    }, []);

    return (
        <div>
            <FileInputArea
                onChange={handleFileChange}
                style={{
                    display: files.length > 0 ? 'none' : 'block'
                }}
            />

            {files.length > 0 && (
                <button
                    onClick={() => {
                        setFiles([]);
                        localStorage.removeItem('files');
                    }}
                >
                    Clear workspace
                </button>
            )}

            <AudioMixer files={files} audioContext={audioContext} />
        </div>
    );
}

export default AudioFilePicker;