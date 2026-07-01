import React, { useState, useEffect, useRef, createContext } from "react";
import { socket } from "../config/config";
import { getCurrentUser, getCallableUsers } from "../config/callers";
import Peer from "simple-peer";

const VideoCallContext = createContext();

// ICE servers tell WebRTC how to traverse NAT/firewalls.
// STUN (free) discovers your public address; TURN relays media when a
// direct connection is impossible. The relay hostnames below are public
// (Metered), but the username/credential are secret and come from env
// vars (set in client/.env locally, and in your host's dashboard in prod).
const TURN_USERNAME = process.env.REACT_APP_TURN_USERNAME;
const TURN_CREDENTIAL = process.env.REACT_APP_TURN_CREDENTIAL;

const turnServers =
  TURN_USERNAME && TURN_CREDENTIAL
    ? [
        "turn:global.relay.metered.ca:80",
        "turn:global.relay.metered.ca:80?transport=tcp",
        "turn:global.relay.metered.ca:443",
        "turns:global.relay.metered.ca:443?transport=tcp",
      ].map((urls) => ({
        urls,
        username: TURN_USERNAME,
        credential: TURN_CREDENTIAL,
      }))
    : [];

const peerConfig = {
  iceServers: [
    { urls: "stun:stun.relay.metered.ca:80" },
    ...turnServers,
  ],
};

const VideoCallProvider = ({ children }) => {
  // Identity comes from the URL path (e.g. /alice), not a random socket id.
  const currentUser = getCurrentUser();
  const callableUsers = currentUser ? getCallableUsers(currentUser.id) : [];

  const [userStream, setUserStream] = useState(null);
  const [call, setCall] = useState({});
  const [isCallAccepted, setIsCallAccepted] = useState(false);
  const [isCallEnded, setIsCallEnded] = useState(false);
  const [myUserId] = useState(currentUser?.id || "");
  const [partnerUserId, setPartnerUserId] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [chatMessages, setChatMessages] = useState([]);
  const [receivedMessage, setReceivedMessage] = useState("");
  const [name, setName] = useState(currentUser?.name || "");
  const [opponentName, setOpponentName] = useState("");
  const [isMyVideoActive, setIsMyVideoActive] = useState(true);
  const [isPartnerVideoActive, setIsPartnerVideoActive] = useState();
  const [isMyMicActive, setIsMyMicActive] = useState(true);
  const [isPartnerMicActive, setIsPartnerMicActive] = useState();
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const myVideoRef = useRef();
  const partnerVideoRef = useRef();
  const peerConnectionRef = useRef();
  const screenShareTrackRef = useRef();

  useEffect(() => {
    const getUserMediaStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setUserStream(stream);
        if (myVideoRef.current) {
          myVideoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing media devices:", error);
      }
    };

    const handleSocketEvents = () => {
      // Announce our identity to the server now and on every reconnect, so
      // the server can route calls to us by our stable userId.
      const registerIdentity = () => {
        if (currentUser) {
          socket.emit("register", currentUser.id);
        }
      };
      registerIdentity();
      socket.on("connect", registerIdentity);

      socket.on("presence", (onlineIds) => {
        setOnlineUsers(onlineIds);
      });

      socket.on("callError", ({ message }) => {
        alert(message);
      });

      socket.on("mediaStatusChanged", ({ mediaType, isActive }) => {
        if (isActive !== null) {
          if (mediaType === "video") {
            setIsPartnerVideoActive(isActive);
          } else if (mediaType === "audio") {
            setIsPartnerMicActive(isActive);
          } else {
            setIsPartnerMicActive(isActive[0]);
            setIsPartnerVideoActive(isActive[1]);
          }
        }
      });

      socket.on("callTerminated", () => {
        setIsCallEnded(true);
        window.location.reload();
      });

      socket.on("incomingCall", ({ from, name, signal }) => {
        setCall({ isReceivingCall: true, from, name, signal });
      });

      socket.on("receiveMessage", ({ message: text, senderName }) => {
        const receivedMsg = { text, senderName };
        setReceivedMessage(receivedMsg);

        const timeout = setTimeout(() => {
          setReceivedMessage({});
        }, 1000);

        return () => clearTimeout(timeout);
      });
    };

    getUserMediaStream();
    handleSocketEvents();
  }, []);

  const receiveCall = () => {
    setIsCallAccepted(true);
    setPartnerUserId(call.from);
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: userStream,
      config: peerConfig,
    });

    peer.on("signal", (data) => {
      socket.emit("answerCall", {
        signal: data,
        to: call.from,
        userName: name,
        mediaType: "both",
        mediaStatus: [isMyMicActive, isMyVideoActive],
      });
    });

    peer.on("stream", (currentStream) => {
      if (partnerVideoRef.current) {
        partnerVideoRef.current.srcObject = currentStream;
      }
    });
    peer.signal(call.signal);
    peerConnectionRef.current = peer;
  };

  const callUser = (targetId) => {
    if (!targetId) {
      alert("Enter an ID to call (paste the other person's ID).");
      return;
    }
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: userStream,
      config: peerConfig,
    });
    setPartnerUserId(targetId);

    const handleSignal = (data) => {
      socket.emit("initiateCall", {
        targetUserId: targetId,
        signalData: data,
        senderId: myUserId,
        senderName: name,
      });
    };

    const handleStream = (currentStream) => {
      partnerVideoRef.current.srcObject = currentStream;
    };

    const joinAcceptedCall = ({ signal, userName }) => {
      setIsCallAccepted(true);
      setOpponentName(userName);
      peer.signal(signal);
      socket.emit("changeMediaStatus", {
        targetUserId: targetId,
        mediaType: "both",
        isActive: [isMyMicActive, isMyVideoActive],
      });
    };

    peer.on("signal", handleSignal);
    peer.on("stream", handleStream);
    socket.on("callAnswered", joinAcceptedCall);

    peerConnectionRef.current = peer;
  };

  const toggleVideo = () => {
    const newStatus = !isMyVideoActive;
    setIsMyVideoActive(newStatus);

    userStream.getVideoTracks().forEach((track) => {
      track.enabled = newStatus;
    });

    socket.emit("changeMediaStatus", {
      targetUserId: partnerUserId,
      mediaType: "video",
      isActive: newStatus,
    });

    return newStatus;
  };

  const toggleMicrophone = () => {
    const newStatus = !isMyMicActive;
    setIsMyMicActive(newStatus);

    userStream.getAudioTracks().forEach((track) => {
      track.enabled = newStatus;
    });

    socket.emit("changeMediaStatus", {
      targetUserId: partnerUserId,
      mediaType: "audio",
      isActive: newStatus,
    });

    return newStatus;
  };

  const toggleScreenSharingMode = () => {
    if (!isMyVideoActive) {
      alert("Please turn on your video to share the screen");
      return;
    }
    if (!isScreenSharing) {
      navigator.mediaDevices
        .getDisplayMedia({ cursor: true })
        .then((screenStream) => {
          const screenTrack = screenStream.getTracks()[0];
          const videoTracks = peerConnectionRef.current.streams[0].getTracks();
          const videoTrack = videoTracks.find(
            (track) => track.kind === "video"
          );
          peerConnectionRef.current.replaceTrack(
            videoTrack,
            screenTrack,
            userStream
          );
          screenTrack.onended = () => {
            peerConnectionRef.current.replaceTrack(
              screenTrack,
              videoTrack,
              userStream
            );
            myVideoRef.current.srcObject = userStream;
            setIsScreenSharing(false);
          };
          myVideoRef.current.srcObject = screenStream;
          screenShareTrackRef.current = screenTrack;
          setIsScreenSharing(true);
        })
        .catch((error) => {
          console.log("Failed to get screen sharing stream");
        });
    } else {
      screenShareTrackRef.current.stop();
      screenShareTrackRef.current.onended();
    }
  };

  const toggleFullScreen = (e) => {
    const element = e.target;

    if (!document.fullscreenElement) {
      element.requestFullscreen().catch((err) => {
        console.error(`Error: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const endCall = () => {
    setIsCallEnded(true);
    socket.emit("terminateCall", { targetUserId: partnerUserId });
    peerConnectionRef.current.destroy();
    window.location.reload();
  };

  const endIncomingCall = () => {
    socket.emit("terminateCall", { targetUserId: partnerUserId });
  };

  const sendMessage = (text) => {
    const newMessage = {
      message: text,
      type: "sent",
      timestamp: Date.now(),
      sender: name,
    };

    setChatMessages((prevMessages) => [...prevMessages, newMessage]);

    socket.emit("sendMessage", {
      targetUserId: partnerUserId,
      message: text,
      senderName: name,
    });
  };

  return (
    <VideoCallContext.Provider
      value={{
        call,
        isCallAccepted,
        myVideoRef,
        partnerVideoRef,
        userStream,
        name,
        setName,
        isCallEnded,
        myUserId,
        currentUser,
        callableUsers,
        onlineUsers,
        callUser,
        endCall,
        receiveCall,
        sendMessage,
        receivedMessage,
        chatMessages,
        setChatMessages,
        setReceivedMessage,
        setPartnerUserId,
        endIncomingCall,
        opponentName,
        isMyVideoActive,
        setIsMyVideoActive,
        isPartnerVideoActive,
        setIsPartnerVideoActive,
        toggleVideo,
        isMyMicActive,
        isPartnerMicActive,
        toggleMicrophone,
        isScreenSharing,
        toggleScreenSharingMode,
        toggleFullScreen,
      }}
    >
      {children}
    </VideoCallContext.Provider>
  );
};

export { VideoCallContext, VideoCallProvider };
