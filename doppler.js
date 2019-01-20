//Team Unity
window.doppler = (function() {
  var AuContext = (window.AudioContext ||
                   window.webkitAudioContext ||
                   window.mozAudioContext ||
                   window.oAudioContext ||
                   window.msAudioContext);

  var ctx = new AuContext();
  var osc = ctx.createOscillator();
  var freq = 20000;

  var relevantFreqWindow = 33;

  var getBandwidth = function(analyser, freqs) {
    var primaryTone = freqToIndex(analyser, freq);
    var primaryVolume = freqs[primaryTone];
    var maxVolumeRatio = 0.001;

    var leftBandwidth = 0;
    do {
      leftBandwidth++;
      var volume = freqs[primaryTone-leftBandwidth];
      var normalizedVolume = volume / primaryVolume;
    } while (normalizedVolume > maxVolumeRatio && leftBandwidth < relevantFreqWindow);

    var rightBandwidth = 0;
    do {
      rightBandwidth++;
      var volume = freqs[primaryTone+rightBandwidth];
      var normalizedVolume = volume / primaryVolume;
    } while (normalizedVolume > maxVolumeRatio && rightBandwidth < relevantFreqWindow);

    return { left: leftBandwidth, right: rightBandwidth };
  };

  var freqToIndex = function(analyser, freq) {
    var nyquist = ctx.sampleRate / 2;
    return Math.round( freq/nyquist * analyser.fftSize/2 );
  };

  var indexToFreq = function(analyser, index) {
    var nyquist = ctx.sampleRate / 2;
    return nyquist/(analyser.fftSize/2) * index;
  };

  var optimizeFrequency = function(osc, analyser, freqSweepStart, freqSweepEnd) {
    var oldFreq = osc.frequency.value;

    var audioData = new Uint8Array(analyser.frequencyBinCount);
    var maxAmp = 0;
    var maxAmpIndex = 0;

    var from = freqToIndex(analyser, freqSweepStart);
    var to   = freqToIndex(analyser, freqSweepEnd);
    for (var i = from; i < to; i++) {
      osc.frequency.value = indexToFreq(analyser, i);
      analyser.getByteFrequencyData(audioData);

      if (audioData[i] > maxAmp) {
        maxAmp = audioData[i];
        maxAmpIndex = i;
      }
    }
    if (maxAmpIndex == 0) {
      return oldFreq;
    }
    else {
      return indexToFreq(analyser, maxAmpIndex);
    }
  };

  var readMicInterval = 0;
  var readMic = function(analyser, userCallback) {
    var audioData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(audioData);

    var band = getBandwidth(analyser, audioData);
    userCallback(band);

    readMicInterval = setTimeout(readMic, 1, analyser, userCallback);
  };

  var handleMic = function(stream, callback, userCallback) {
    var mic = ctx.createMediaStreamSource(stream);
    var analyser = ctx.createAnalyser();

    analyser.smoothingTimeConstant = 0.5;
    analyser.fftSize = 2048;

    mic.connect(analyser);


    osc.frequency.value = freq;
    osc.type = osc.SINE;
    osc.start(0);
    osc.connect(ctx.destination);
    setTimeout(function() {
      freq = optimizeFrequency(osc, analyser, 19000, 22000);
      osc.frequency.value = freq;

      clearInterval(readMicInterval);
      callback(analyser, userCallback);
    });
  };

  return {
    init: function(callback) {
      navigator.getUserMedia_ = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
      navigator.getUserMedia_({ audio: { optional: [{ echoCancellation: false }] } }, function(stream) {
        handleMic(stream, readMic, callback);
      }, function() { alert('Please allow access to the microphone') });
    },
    stop: function () {
      clearInterval(readMicInterval);
      osc.stop();
      osc = ctx.createOscillator();
    }
  }
})(window, document);

