/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';

var bridge1Connection;
var bridge2Connection;
var participantConnection;
var sendChannel;
var receiveChannel;
var dataConstraint;
var dataChannelSend = document.querySelector('textarea#dataChannelSend');
var dataChannelReceive = document.querySelector('textarea#dataChannelReceive');
var startButton = document.querySelector('button#startButton');
var sendButton = document.querySelector('button#sendButton');
var restartIceButton = document.querySelector('button#restartIce');
var closeButton = document.querySelector('button#closeButton');
var iceRestarted = false;

startButton.onclick = createConnection;
sendButton.onclick = sendData;
restartIceButton.onclick = restartIce;
closeButton.onclick = closeDataChannels;

function enableStartButton() {
  startButton.disabled = false;
}

function disableSendButton() {
  sendButton.disabled = true;
}

function createConnection() {
  dataChannelSend.placeholder = '';
  var servers = null;
  dataConstraint = null;
  trace('Using SCTP based data channels');
  // SCTP is supported from Chrome 31 and is supported in FF.
  // No need to pass DTLS constraint as it is on by default in Chrome 31.
  // For SCTP, reliable and ordered is true by default.
  // Add bridge1Connection to global scope to make it visible
  // from the browser console.
  window.bridge1Connection = bridge1Connection =
      new RTCPeerConnection(servers);
  trace('Created local peer connection object bridge1Connection');

  sendChannel = bridge1Connection.createDataChannel('sendDataChannel',
      dataConstraint);
  trace('Created send data channel');

  bridge1Connection.onicecandidate = function(e) {
    onIceCandidate(bridge1Connection, e);
  };
  sendChannel.onopen = onSendChannelStateChange;
  sendChannel.onclose = onSendChannelStateChange;

  createRemoteConnection();

  bridge1Connection.createOffer().then(
    gotDescription1,
    onCreateSessionDescriptionError
  );
  startButton.disabled = true;
  restartIceButton.disabled = false;
  closeButton.disabled = false;
}

function createRemoteConnection() {
  var servers = null;
  // Add participantConnection to global scope to make it visible
  // from the browser console.
  window.participantConnection = participantConnection =
      new RTCPeerConnection(servers);
  trace('Created remote peer connection object participantConnection');

  participantConnection.onicecandidate = function(e) {
    onIceCandidate(participantConnection, e);
  };
  participantConnection.ondatachannel = receiveChannelCallback;
}

function restartIce() {
    iceRestarted = true;
    //bridge1Connection.close();
    bridge2Connection = new RTCPeerConnection(null);
    bridge2Connection.onicecandidate = function(e) {
      onIceCandidate(bridge2Connection, e);
    };
    sendChannel = bridge2Connection.createDataChannel('sendDataChannel2', { id: 3 });
    sendChannel.onopen = onSendChannelStateChange;
    sendChannel.onclose = onSendChannelStateChange;

    bridge2Connection.createOffer().
        then(desc => {
            trace('Created bridge2 offer');
            bridge2Connection.setLocalDescription(desc);
            participantConnection.setRemoteDescription(desc);
            participantConnection.createAnswer().then(desc => {
                participantConnection.setLocalDescription(desc);
                bridge1Connection.close();
                bridge2Connection.setRemoteDescription(desc);
            },
            err => {
                trace('Error creating remote answer: ' + err);
            });
        },
        err => {
            trace('Error creating bridge2 offer: ' + err);
        });
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function sendData() {
  var data = dataChannelSend.value;
  sendChannel.send(data);
  trace('Sent Data on channel: ' + sendChannel.label + ":" + data);
}

function closeDataChannels() {
  trace('Closing data channels');
  sendChannel.close();
  trace('Closed data channel with label: ' + sendChannel.label);
  receiveChannel.close();
  trace('Closed data channel with label: ' + receiveChannel.label);
  bridge1Connection.close();
  participantConnection.close();
  bridge1Connection = null;
  participantConnection = null;
  trace('Closed peer connections');
  startButton.disabled = false;
  sendButton.disabled = true;
  closeButton.disabled = true;
  restartIceButton.disabled = true;
  dataChannelSend.value = '';
  dataChannelReceive.value = '';
  dataChannelSend.disabled = true;
  disableSendButton();
  enableStartButton();
}

function gotDescription1(desc) {
  bridge1Connection.setLocalDescription(desc);
  trace('Offer from bridge1Connection \n' + desc.sdp);
  participantConnection.setRemoteDescription(desc);
  participantConnection.createAnswer().then(
    gotDescription2,
    onCreateSessionDescriptionError
  );
}

function gotDescription2(desc) {
  participantConnection.setLocalDescription(desc);
  trace('Answer from participantConnection \n' + desc.sdp);
  bridge1Connection.setRemoteDescription(desc);
}

function getOtherPc(pc) {
  if (iceRestarted) {
    trace('getOtherPc: ice has restarted');
    return (pc === bridge2Connection) ? participantConnection : bridge2Connection;
  } else {
    return (pc === bridge1Connection) ? participantConnection : bridge1Connection;
  }
}

function getName(pc) {
  if (pc === bridge1Connection) return 'bridge1Connection';
  else if (pc === bridge2Connection) return 'bridge2Connection';
  return 'participant connection';
}

function onIceCandidate(pc, event) {
  getOtherPc(pc).addIceCandidate(event.candidate)
  .then(
    function() {
      onAddIceCandidateSuccess(pc);
    },
    function(err) {
      onAddIceCandidateError(pc, err);
    }
  );
  trace(getName(pc) + ' ICE candidate: \n' + (event.candidate ?
      event.candidate.candidate : '(null)'));
}

function onAddIceCandidateSuccess() {
  trace('AddIceCandidate success.');
}

function onAddIceCandidateError(error) {
  trace('Failed to add Ice Candidate: ' + error.toString());
}

function receiveChannelCallback(event) {
  trace('Receive Channel Callback');
  receiveChannel = event.channel;
  receiveChannel.onmessage = onReceiveMessageCallback;
  receiveChannel.onopen = onReceiveChannelStateChange;
  receiveChannel.onclose = onReceiveChannelStateChange;
}

function onReceiveMessageCallback(event) {
  trace('Received Message');
  dataChannelReceive.value = event.data;
}

function onSendChannelStateChange() {
  var readyState = sendChannel.readyState;
  trace('Send channel state is: ' + readyState);
  if (readyState === 'open') {
    dataChannelSend.disabled = false;
    dataChannelSend.focus();
    sendButton.disabled = false;
    closeButton.disabled = false;
  } else {
    dataChannelSend.disabled = true;
    sendButton.disabled = true;
    closeButton.disabled = true;
  }
}

function onReceiveChannelStateChange() {
  var readyState = receiveChannel.readyState;
  trace('Receive channel state is: ' + readyState);
}
