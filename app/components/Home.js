// @flow
import React, { Component } from 'react';
import { Link } from 'react-router';

import fs from 'fs-extra';
import path from 'path';
import fileType from 'file-type';
import readChunk from 'read-chunk';
import uuid from 'uuid';
import * as RxDB from 'rxdb';
import pouchWebSQL from 'pouchdb-adapter-websql';
import pouchHTTP from 'pouchdb-adapter-http';
import pouchReplication from 'pouchdb-replication';
import { makeElectronPath } from './electron-utils';
import styles from './Home.css';

console.log(RxDB);

// Setup offline data sync
RxDB.plugin(pouchWebSQL);
RxDB.plugin(pouchHTTP);
RxDB.plugin(pouchReplication);

const audioSchema = {
  title: 'audio schema',
  description: 'describes a simple audio file',
  type: 'object',
  properties: {
    name: {
      type: 'string',
      primary: 'true'
    },
    description: {
      type: 'string'
    },
    createdAt: {
      type: 'string'
    },
  },
  required: ['createdAt']
};

console.log(`hostname: ${window.location.hostname}`);
const syncURL = `http://${window.location.hostname}:10102/`;

let database, column;

RxDB
  .create('audioDB', 'websql', 'ASDFASDF', true)
  .then((db) => {
    database = db;
    return db.collection('audio', audioSchema);
  })
  .then((col) => {
    column = col;
    return column;
  })
  // .then((col) => {
  //   console.log('DatabaseService: sync');
  //   col.sync(`${syncURL}hero/`);
  //   return col;
  // })
  .then((col) => {
    return col
      .query()
      .sort({
        name: 1
      })
      .$.subscribe((heroes) => {
        if (!heroes) {
          // heroesList.innerHTML = 'Loading..';
          return;
        }
        console.log('observable fired');
        console.dir(heroes);
        // heroesList.innerHTML = '';
        // heroes.forEach(function(hero) {
        //     heroesList.innerHTML = heroesList.innerHTML +
        //         '<li>' +
        //         '<div class="color-box" style="background:' + hero.get('color') + '"></div>' +
        //         '<div class="name">' + hero.get('name') + '</div>' +
        //         '</li>'
        // });
      });
  });

// Helper to get paths of files in the electron audio directory
const audioFile = (theFilename) => path.join(makeElectronPath('audio'), theFilename);

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
        return fileInfo !== null && fileInfo.mime.indexOf('webm');
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
        const blob = new Blob(chunks, { type: 'audio/webm;' });

        // Convert the blob to a base 64 encoded string
        blobToBase64(blob, (base64) => {
          // Create a buffer from the base64 encoded string
          const buf = new Buffer(base64, 'base64');

          // Write the buffer to a file
          writeFile(audioFile(uuid.v4() + '.webm'), buf, (err) => {
            if (err) {
              console.log('err', err);
            } else {
              this.getAudioFiles();
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
  deleteAudio(file) {
    fs.remove(file, (err) => {
      if (err) {
        return console.error(err);
      }
      console.log('deleted', file);
      this.getAudioFiles();
    });
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
          <ul style={{ height: 400, overflow: 'scroll' }}>
            {this.state.files.map((file, index) => <li
              style={{
                display: 'block',
                height: 100,
                background: '#fff',
                margin: 5,
                color: '#333',
                width: 300
              }}
              key={index}
            ><audio src={audioFile(file)} controls="true" loop="loop" />{file}<button onClick={this.deleteAudio.bind(this, audioFile(file))}>Delete</button></li>)}
          </ul>
        </div>
      </div>
    );
  }
}
