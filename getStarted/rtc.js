let localVideo = document.getElementById('localVideo');
let remoteVideo = document.getElementById('remoteVideo');
let isInitiator = false;
let isChannelReady = false;
let isStarted = false;
let localStream;
let remoteStream;
let pc;
let pcConfig = {
  iceServers: [
    {
      urls: 'stun:stum.l.google.com:19302',
    },
  ],
};
let room = 'foo';

let socket = io.connect();

if (room !== '') {
  socket.emit('create or join', room);
  console.log('Attempted to create or join room', room);
}

socket.on('created', (room, id) => {
  console.log(`Created room ${room} socket ID : ${id}`);
  isInitiator = true;
});

socket.on('joined', (room) => {
  console.log(`joined : ${room}`);
  isChannelReady = true;
});

socket.on('log', (array) => {
  console.log(array);
});

socket.on('message', (message) => {
  console.log(`Click received message : ${message}`);

  if (message === 'got user media') {
    maybeStart();
  } else if (message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }

    pc.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === 'answer' && isStarted) {
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate' && isStarted) {
    const candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate,
    });

    pc.addIceCandidate(candidate);
  }
});

function sendMessage(message) {
  console.log('Client sending message : ', message);
}

// Get Local Stream
navigator.mediaDevices
  .getUserMedia({
    audio: false,
    video: true,
  })
  .then(gotStream)
  .catch((e) => {
    console.log(e);
  });

function gotStream(stream) {
  console.log('Adding local stream.');

  localStream = stream;
  localVideo.srcObject = stream;

  sendMessage('got user media');

  if (isInitiator) {
    maybeStart();
  }
}

function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', message);
}

// connect RTC Peer
function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(null);
    pc.onicecandidate = handleIceCandidate;
  } catch (error) {
    console.log('can not create RTCPeerConnection object');
  }
}

function handleIceCandidate(event) {
  console.log('iceCandidateEvent', event);

  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate,
    });
  } else {
    console.log('end of cadidates');
  }
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function handleRemoteStreamAdded(event) {
  console.log('remote stream added');
  remoteStream = event.stream;
  remoteVideo.srcObject = remoteStream;
}

function maybeStart() {
  console.log('>>MaybeStart() : ', isStarted, localStream, isChannelReady);

  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    console.log('>>> creating peer connection');

    createPeerConnection();
    pc.addStream(localStream);
    isStarted = true;
    console.log('isInitiator : ', isInitiator);

    if (isInitiator) {
      doCall();
    }
  } else {
    console.log('Failed to call');
  }
}

function doCall() {
  console.log('Sending offer to peer');
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  console.log('Sending answer to peer');
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  sendMessage(sessionDescription);
}
