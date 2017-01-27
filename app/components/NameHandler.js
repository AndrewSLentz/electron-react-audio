import React, {Component} from 'react';

export default class NameHandler extends Component {
  trackChange(fileRx, e) {
    fileRx.set('track', e.target.value).save();
  }
  render() {
    return (
      <input onChange={this.trackChange.bind(this, this.props.fileRx)} value={this.props.fileRx.get('track')} type="text" placeholder='name track' style={{
        margin: '.25rem',
        textAlign: 'center'
      }}
      />
    );
  }
}
