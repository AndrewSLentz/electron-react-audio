// @flow
import React, { Component } from 'react';
import { Link } from 'react-router';
import fs from 'fs';
import path from 'path';
import electron from 'electron';
import styles from './Home.css';

const { app } = electron.remote;

function file(theFilename) {
  // Get the path to Electron's storage
  const dir = path.dirname(app.getAppPath());
  // Add the filename to that directory
  return path.join(dir, theFilename);
}

export default class Home extends Component {
  onWriteButtonClick() {
    try {
      fs.writeFileSync(file('Yo'), 'OH HEYYYYYY', 'utf-8');
      console.log('Just wrote to a file. Run this command to see the contents:');
      console.log('cat ' + file('Yo'));
    } catch (e) {
      alert('Failed to save the file !');
    }
  }
  onReadButtonClick() {
    try {
      const fileContents = fs.readFileSync(file('Yo'), 'utf-8');
      console.log('Just read from a file. Here are the contents:', fileContents);
    } catch (e) {
      alert('Failed to read the file!');
    }
  }
  getAudio() {
    // Prefer camera resolution nearest to 1280x720.
    var constraints = { audio: true, video: false };
    var usermedia = navigator.mediaDevices.getUserMedia(constraints)
    .then((mediaStream) => {
      console.log(mediaStream.getTracks());
      this.setState({
        mediaStream
      });
      
      var audio = document.querySelector('audio');
      audio.srcObject = mediaStream;
      audio.onloadedmetadata = function(e) {
        audio.play();
      };
    })
    .catch(function(err) { console.log(err.name + ": " + err.message); }); // always check for errors at the end.
    this.setState({usermedia});
  }
  stop() {
    // Loop over all streams (audio is 0, video is 1);
    this.state.mediaStream.getTracks().map((stream) => {
      stream.stop();
    })
    
  }
  render() {
    return (
      <div>
        <div className={styles.container}>
          <h2>Home</h2>
          <audio />
          <Link to="/counter">to Counter</Link><br/>
          <button onClick={this.onWriteButtonClick.bind(this)}>Write</button>
          <button onClick={this.onReadButtonClick.bind(this)}>Read</button>
          <button onClick={this.getAudio.bind(this)}>Record</button>
          <button onClick={this.stop.bind(this)}>Stop</button>
        </div>
      </div>
    );
  }
}
