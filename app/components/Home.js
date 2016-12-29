// @flow
import React, { Component } from 'react';
import { Link } from 'react-router';

import fs from 'fs';
import path from 'path';
import electron from 'electron';
import fileType from 'file-type';
import readChunk from 'read-chunk';
import styles from './Home.css';


// Helper to get the electron app directory
const getElectronAppDirectory = (electronInstance) => {
  const appPath = electronInstance.remote.app.getAppPath();
  return path.dirname(appPath);
};

// Helper to make sure that files are created
// in the correct electron subdirectory
const makeElectronPath = (subPath) => {
  // Get the path to Electron's storage
  const fullpath = path.join(getElectronAppDirectory(electron), subPath);
  mkdirp(fullpath);
  return fullpath;
};

// Helper to get paths of files in the electron audio directory
const audioFile = (theFilename) => path.join(makeElectronPath('audio'), theFilename);

// Synchronously checks if a path exists
const directoryExists = (dpath) => {
  try {
    return fs.lstatSync(dpath).isDirectory();
  } catch (e) {
    return false;
  }
};

// Synchronously creates a directory
const mkdirp = (dirname) => {
  const nDirname = path.normalize(dirname).split(path.sep);
  nDirname.forEach((sdir, index) => {
    const pathInQuestion = nDirname.slice(0, index + 1).join(path.sep);
    if ((!directoryExists(pathInQuestion)) && pathInQuestion) fs.mkdirSync(pathInQuestion);
  });
};

// Asynchronously convert a blob to a base64 string
const blobToBase64 = (blob, cb) => {
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    const base64 = dataUrl.split(',')[1];
    cb(base64);
  };
  reader.readAsDataURL(blob);
};

// Synchronously write a file to a path
const writeFileSync = (filePath, contents) => {
  try {
    fs.writeFileSync(filePath, contents, 'utf-8');
    console.log('Just wrote to a file. Run this command to see the contents:');
    console.log(`cat ${audioFile(filePath)}`);
  } catch (e) {
    alert('Failed to save the file !');
  }
};

// Asynchronously write a file to an absolute path
const writeFile = (filePath, contents, cb) => {
  try {
    console.log('Writing to a file. Run this command to see the contents:');
    console.log(`cat ${filePath}`);
    fs.writeFile(filePath, contents, cb);
  } catch (e) {
    alert('Failed to save the file !');
  }
};

// Synchronously read a file's contents
const readFile = (filename) => {
  try {
    const fileContents = fs.readFileSync(filename, 'utf-8');
    console.log('Just read from a file. Here are the contents:', fileContents);
    return fileContents;
  } catch (e) {
    alert('Failed to read the file!');
  }
};

export default class Home extends Component {
  constructor(props) {
    super(props);
    this.state = {
      mediaStream: {},
      mediaRecorder: {},
      files: []
    };
  }
  componentDidMount() {
    this.getAudioFiles();
  }
  getAudioFiles() {
    fs.readdir(makeElectronPath('audio'), (err, files) => {
      console.log(files);
      const audioFiles = files.filter((file) => {
        const buffer = readChunk.sync(audioFile(file), 0, 4100);
        const fileInfo = fileType(buffer);
        console.log(fileInfo);
        return fileInfo !==null && fileInfo.mime === 'audio/ogg';
      });
      this.setState({
        files: audioFiles
      });
    });
  }
  getAudio() {
    // Get audio using the user's microphone
    window.navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false
    })
    .then((mediaStream) => {
      // Use a media recorder to record the stream
      const mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'audio/webm' });

      // An array of all of the chunks of audio we'll hold
      // See https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/ondataavailable
      const chunks = [];

      // When the media recorder is stopped, get the final audio
      mediaRecorder.onstop = () => {
        console.log('data available after MediaRecorder.stop() called.');

        // Take all of the chunks of bytes and put them together into a blob
        const blob = new Blob(chunks, { type: 'audio/webm; codecs=opus' });

        // Convert the blob to a base 64 encoded string
        blobToBase64(blob, (base64) => {
          // Create a buffer from the base64 encoded string
          const buf = new Buffer(base64, 'base64');

          // Write the buffer to a file
          writeFile(audioFile('test.webm'), buf, (err) => {
            if (err) {
              console.log('err', err);
            } else {
              return console.log({ status: 'success' });
            }
          });
        });
      };

      // Fires whenever a new chunk of data is available from the recorder
      mediaRecorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      // Fires if there is an error during media recording
      mediaRecorder.onerror = (err) => {
        console.log(err);
      };

      // Start the media recorder
      mediaRecorder.start();

      // Create an element on the page to play the audio while it is
      // being recorded
      const audio = document.querySelector('#audio-one');

      // Set its source to the live stream
      audio.srcObject = mediaStream;

      // When the initial load happens, play immediately
      audio.onloadedmetadata = () => {
        audio.play();
      };

      // Store the media stream in state, we'll need this when
      // the user decides to stop recording and we want to get
      // a blob representing the recording
      this.setState({
        mediaRecorder,
        mediaStream,
        audioElement: audio
      });

      return {
        mediaStream,
        audioElement: audio
      };
    })
    .catch((err) => { console.error(`${err.name} : ${err.message}`); }); // always check for errors at the end.
  }
  stop() {
    // Stop the media recorder
    this.state.mediaRecorder.stop();

    // Loop over all audio tracks
    this.state.mediaStream.getAudioTracks().map((track) => {
      // Stop each track
      track.stop();
      return track;
    });

    // Stops the audio element and resets the time to 0,
    // TODO: Get the play button to actually replay the last audio recorded.
    this.state.audioElement.pause();
    this.state.audioElement.currentTime = 0;
  }
  render() {
    return (
      <div>
        <div className={styles.container}>
          <h2>Record</h2>
          <audio id="audio-one" />
          <Link to="/counter">to Counter</Link><br />
          <button onClick={writeFileSync.bind(this, 'Yo', 'OH HAIII')}>Write</button>
          <button onClick={readFile.bind(this, 'Yo')}>Read</button>
          <button onClick={this.getAudio.bind(this)}>Record</button>
          <button onClick={this.stop.bind(this)}>Stop</button>
          <ul>
            {this.state.files.map((file) => <li>{file}</li>)}
          </ul>
        </div>
      </div>
    );
  }
}
