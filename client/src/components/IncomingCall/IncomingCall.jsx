import React, { useContext, useState, useEffect, useRef } from "react";
import answercall from "../../assets/answer-call.gif";
import { VideoCallContext } from "../../context/Context";
import { Button, Modal } from "react-bootstrap";
import { MdCallEnd } from "react-icons/md";
import ringtone from "../../assets/ringtone.ogg";
import "./IncomingCall.css";

const IncomingCall = () => {
  const {
    receiveCall,
    call,
    isCallAccepted,
    endIncomingCall,
    setPartnerUserId,
  } = useContext(VideoCallContext);
  const [showModal, setShowModal] = useState(false);
  const audioRef = useRef();

  const handleClose = () => {
    setShowModal(false);
    if (call.isReceivingCall && !isCallAccepted) {
      endIncomingCall();
    }
    window.location.reload();
  };

  const handleCallAnswer = () => {
    receiveCall();
    setShowModal(false);
  };

  useEffect(() => {
    if (call.isReceivingCall && !isCallAccepted) {
      setShowModal(true);
      setPartnerUserId(call.from);
    }
  }, [call.from, call.isReceivingCall, isCallAccepted, setPartnerUserId]);

  // Browsers block audio that plays before the user has interacted with the
  // page. Prime the ringtone (play muted, then reset) on the first click or
  // keypress so it's allowed to ring when a call later comes in.
  useEffect(() => {
    const unlockAudio = () => {
      const audio = audioRef.current;
      if (audio) {
        audio.muted = true;
        const playPromise = audio.play();
        if (playPromise) {
          playPromise
            .then(() => {
              audio.pause();
              audio.currentTime = 0;
              audio.muted = false;
            })
            .catch(() => {
              audio.muted = false;
            });
        }
      }
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };

    window.addEventListener("pointerdown", unlockAudio);
    window.addEventListener("keydown", unlockAudio);
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  useEffect(() => {
    if (showModal && audioRef.current) {
      const playPromise = audioRef.current.play();
      if (playPromise) {
        // Autoplay can still be blocked if the user never interacted yet.
        playPromise.catch(() => {});
      }
    } else if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [showModal]);

  return (
    <>
      <audio src={ringtone} loop ref={audioRef} />
      <Modal show={showModal} onHide={handleClose} centered>
        <Modal.Header className="call-modal-header" closeButton>
          <Modal.Title className="call-modal-title">
            {call.name ? call.name : "Someone"} is calling:
          </Modal.Title>
        </Modal.Header>
        <Modal.Footer className="call-modal-footer">
          <Button onClick={handleClose} className="decline-call-btn">
            <MdCallEnd size={25} />
          </Button>
          <div className="answer-call-image" onClick={handleCallAnswer}>
            <img src={answercall} alt="Answer Call" />
          </div>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default IncomingCall;
