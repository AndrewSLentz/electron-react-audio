// @flow

import React, {Component} from 'react';
import {Link} from 'react-router';
import Wavesurfer from 'react-wavesurfer';
import NameHandler from './NameHandler'

// For working with files
import fs from 'fs-extra';
import path from 'path';

// For determining what type of files something is
import fileType from 'file-type';
import readChunk from 'read-chunk';

// For generating random ids
import uuid from 'uuid';

// A database that syncs and works offline!
import * as RxDB from 'rxdb';
import pouchWebSQL from 'pouchdb-adapter-websql';
import pouchHTTP from 'pouchdb-adapter-http';
import pouchReplication from 'pouchdb-replication';

import hash from 'object-hash';

// For saving files in electron
import {makeElectronPath} from './electron-utils';
import styles from './Home.css';

// A react audio player that behaves!
import AudioPlayerDOM from './AudioPlayerDOM';

// We need some plugins for offline data sync for our database
RxDB.plugin(pouchWebSQL);
RxDB.plugin(pouchHTTP);
RxDB.plugin(pouchReplication);

// This is a model to describe a single audio file in rxdb
const audioSchema = {
  title: 'audio schema',
  description: 'describes a simple audio file',
  type: 'object',
  properties: {
    name: {
      type: 'string',
      primary: 'true'
    },
    version: {
      type: 'number'
    },
    track: {
      type: 'string'
    },
    description: {
      type: 'string'
    },
    createdAt: {
      type: 'string'
    },
    isRecording: {
      type: 'boolean'
    },
    isActive: {
      type: 'boolean'
    }
  },
  required: ['createdAt']
};

const schemaHash = hash(audioSchema);
const lastSchemaHash = localStorage.getItem('lastSchemaHash');
if (lastSchemaHash !== schemaHash) {
  localStorage.setItem('lashSchemaHash', schemaHash);
  console.log('schema changed! the world was deleted!');
}

let database,
  column;

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
    console.log('Just wrote to a file. Run this command to open the file:');
    console.log(`open ${audioFile(filePath)}`);
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
      files: [],
      audioMetadata: []
    };
  }
  componentDidMount() {
    this.getAudioMetadata();
  }
  getAudioMetadata() {
    RxDB.create('audioDB_version_' + schemaHash, 'websql', 'ASDFASDF', true).then((db) => {
      database = db;
      return db.collection('audio', audioSchema);
    }).then((col) => {
      console.log(col);
      column = col;
      return column;
    })
    // .then((col) => {
    //   console.log('DatabaseService: sync');
    //   col.sync(`${syncURL}hero/`);
    //   return col;
    // })
      .then((col) => {
      return col.query().sort({name: 1}).$.subscribe((audios) => {
        if (!audios) {
          // heroesList.innerHTML = 'Loading..';
          return;
        }
        console.log('observable fired');
        this.setState({audioMetadata: audios});
        console.dir(audios);
      });
    }).catch((err) => {
      console.error(err);
      database.destroy().then(() => {
        // database destroyed
        console.log('there was a conflict in the schema, so I deleted the world')
        return true;
      }).catch(function(er) {
        // error occurred
        console.error(er);
      });
      console.error(err);
    });
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
      this.setState({files: audioFiles});
    });
  }
  getAudio() {
    //show recording indicator
    this.setState({isRecording: true});
    // Get audio using the user's microphone
    window.navigator.mediaDevices.getUserMedia({audio: true, video: false}).then((mediaStream) => {
      // Use a media recorder to record the stream
      const mediaRecorder = new MediaRecorder(mediaStream, {mimeType: 'audio/webm'});

      // An array of all of the chunks of audio we'll hold
      // See https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/ondataavailable
      const chunks = [];
      const id = uuid.v4();

      mediaRecorder.onstart = () => {
        this.startPlayer();
      };
      // When the media recorder is stopped, get the final audio
      mediaRecorder.onstop = () => {
        const obj = {
          name: id,
          version: 1,
          track: '',
          description: 'This is a test',
          createdAt: 'Today',
          isRecording: true,
          isActive: true
        };
        console.log('inserting audio:');
        console.dir(obj);
        console.log(column);
        column.insert(obj);
        console.log('data available after MediaRecorder.stop() called.');

        // Take all of the chunks of bytes and put them together into a blob
        const blob = new Blob(chunks, {type: 'audio/webm;'});

        // Convert the blob to a base 64 encoded string
        blobToBase64(blob, (base64) => {
          // Create a buffer from the base64 encoded string
          const buf = new Buffer(base64, 'base64');

          // Write the buffer to a file
          writeFile(audioFile(id + '.webm'), buf, (err) => {
            console.log('trying to write audio file');
            if (err) {
              console.log('err', err);
            } else {
              return column.findOne(id).exec().then(doc => {
                doc.set('isRecording', false);
                return doc.save().then(() => {
                  console.log(doc.get('isRecording'));
                  this.getAudioMetadata();
                });
              });

              return console.log({status: 'success'});
            }
          });
        });
      };

      // Fires whenever a new chunk of data is available from the recorder
      mediaRecorder.ondataavailable = (e) => {
        console.log('fires whenever a new chunk of data is available');
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
      // audio.srcObject = mediaStream;

      // When the initial load happens, play immediately
      audio.onloadedmetadata = () => {
        audio.play();
      };

      // Store the media stream in state, we'll need this when
      // the user decides to stop recording and we want to get
      // a blob representing the recording
      this.setState({mediaRecorder, mediaStream, audioElement: audio});

      return {mediaStream, audioElement: audio};
    }).catch((err) => {
      console.error(`${err.name} : ${err.message}`);
    }); // always check for errors at the end.
  }
  stop() {
    // hide recording indicator
   this.setState({isRecording: false});
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
  deleteAudio(fileRx) {
    var del = confirm('Delete ' + fileRx.get('track') + '?');
    if (del === true) {
      const file = audioFile(`${fileRx.get('name')}.webm`);
      fileRx.remove();
      fs.remove(file, (err) => {
        if (err) {
          return console.error(err);
        }
        console.log('deleted', file);
        this.getAudioMetadata();
      });
    }
  }
  playerActive(fileRx) {
    fileRx.set('isActive', !fileRx.get('isActive'));
    console.log(fileRx.get('isActive'));
  }
  startPlayer() {
    this.state.audioMetadata.map((fileRx, i) => {
      if (fileRx.get('isActive')) {
        setTimeout(document.getElementById('player' + fileRx.get('name')).play(), (i < 0 ? 1000 : 0));
      }
    });
  }
  render() {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center'
      }}>
        <div className={styles.container}>
          <div className="banner" style={{
            backgroundColor: '#2F80ED'
          }}>
            <h2>Band Together</h2>
            <h3>A Collaborative Writing Tool for Musicians</h3>
          </div>
          <audio id="audio-one"/>
          {/* <button onClick={writeFileSync.bind(this, 'Yo', 'OH HAIII')}>Write</button>
          <button onClick={readFile.bind(this, 'Yo')}>Read</button> */}
          <i className="fa fa-microphone" style={{
            color: 'green',
            fontSize: '25px',
            margin: '.5rem',
            display: this.state.isRecording
              ? 'none'
              : 'inline-block'
          }} onClick={this.getAudio.bind(this)}/>
          <i className="fa fa-microphone-slash" style={{
            color: 'red',
            fontSize: '25px',
            margin: '.5rem',
            display: this.state.isRecording
              ? 'inline-block'
              : 'none'
          }} onClick={this.stop.bind(this)}/>
          <i className="fa fa-play" onClick={this.startPlayer.bind(this)} style={{
            color: 'black',
            fontSize: '25px',
            margin: '.5rem'
          }}/>
          <i className="fa fa-floppy-o" style={{
            fontSize: '25px',
            margin: '.5rem'
          }}/>
          <div className="blink" style={{
            display: this.state.isRecording
              ? 'block'
              : 'none'
          }}>
            <i className="fa fa-circle" id="blink" style={{
              color: 'red',
              fontSize: '20px',
              margin: '.5rem'
            }}/>
          </div>
          <ul style={{
            height: '538px',
            overflow: 'scroll',
            paddingLeft: 0,
            margin: '0 auto'
          }}>
            {this.state.audioMetadata.map((fileRx, index) => {
              // const p = function(proxyObj) {
              //   return new Proxy({}, {
              //     get: (target, name) => {
              //       return proxyObj.get(name);
              //     },
              //   });
              // };
              // const file = p(fileRx);
              console.log('name is ', fileRx.get('name'));
              console.log(audioFile(`${fileRx.get('name')}.webm`))
              return (
                <li style={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: '110px',
                  background: '#fff',
                  margin: '0 auto .5rem auto',
                  color: '#333',
                  width: 300
                }} key={index}>
                  <input type="checkbox" defaultChecked style={{
                    position: 'relative',
                    left: '-2rem',
                    top: '2.5rem'
                  }} onChange={this.playerActive.bind(this, fileRx)}/>
                  <i className="fa fa-times" onClick={this.deleteAudio.bind(this, fileRx)} style={{
                    width: '20px',
                    color: 'red',
                    position: 'relative',
                    left: '19rem',
                    top: '1.5rem',
                    cursor: 'pointer'
                  }}/>
                  <NameHandler fileRx={fileRx}/>
                  <AudioPlayerDOM playerId={'player' + fileRx.get('name')} isSourceAvailable={!fileRx.get('isRecording')} src={audioFile(`${fileRx.get('name')}.webm`)}/>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }
}
