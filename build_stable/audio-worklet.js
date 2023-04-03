// Web worker receiving message
self.addEventListener('message', function (e) {
    // Get the data
    let { audioBufferArray, volumeInDB } = e.data;

    // Create audio buffer channel 0
    let audioBufferChannel0 = new Float32Array(audioBufferArray[0]);

    // Create audio buffer channel 1
    let audioBufferChannel1 = new Float32Array(audioBufferArray[1]);



    // Create audio buffer
    let audioBuffer = new AudioBuffer({
        length: audioBufferChannel0.length,
        numberOfChannels: 2,
        sampleRate: 44100
    });

    // Set the channel data
    audioBuffer.copyToChannel(audioBufferChannel0, 0);
    audioBuffer.copyToChannel(audioBufferChannel1, 1);

    // Create offline audio context
    let offlineCtx = new OfflineAudioContext(2, audioBuffer.length, audioBuffer.sampleRate);
    let bufferSource = offlineCtx.createBufferSource();
    let gainNode = offlineCtx.createGain();

    bufferSource.buffer = audioBuffer;
    bufferSource.connect(gainNode);
    gainNode.connect(offlineCtx.destination);
    gainNode.gain.value = volumeInDB;

    bufferSource.start();
    return offlineCtx.startRendering().then(function (renderedBuffer) {
        // Return the rendered buffer
        self.postMessage(renderedBuffer, [renderedBuffer]);
    });
});