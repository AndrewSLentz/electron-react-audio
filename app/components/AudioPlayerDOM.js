import React, { Component } from 'react';
import ReactDOM from 'react-dom';

const aud = new Audio();

/**
 * Use case: audio player with dynamic source in react
 *
 * Usage:
 *   <AudioPlayerDOM src={this.state.currentFile}/>
 *
 * Todo: make a better api, actually pass props through
 * Todo: use children instead of passing
 */
export default class AudioPlayerDOM extends Component {

  componentWillReceiveProps(nextProps) {
    // Find some DOM nodes
    const element = ReactDOM.findDOMNode(this);
    const audio = element.querySelector('audio');
    const source = audio.querySelector('source');

    // When the url changes, we refresh the component manually so it reloads the loaded file
    if ((nextProps.src) && (nextProps.src !== this.props.src)) {
      // Change the source
      source.src = nextProps.src;
      // Cause the audio element to load the new source
      audio.load();
    }
    if (nextProps.isSourceAvailable) {
      audio.load();
    }
  }

  render() {
    return (
      <div>
        <audio id={this.props.playerId} controls>
          <source src={this.props.src} />
        </audio>
      </div>
    );
  }
}
