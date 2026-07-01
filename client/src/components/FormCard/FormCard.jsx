import React, { useState, useContext, useEffect, useRef } from "react";
import { VideoCallContext } from "../../context/Context";
import { MdCall } from "react-icons/md";
import { Card, Form, Button } from "react-bootstrap";
import { callers, getCallTarget } from "../../config/callers";
import "./FormCard.css";

const FormCard = () => {
  const {
    name,
    setName,
    callUser,
    isCallAccepted,
    currentUser,
    callableUsers,
    onlineUsers,
    userStream,
  } = useContext(VideoCallContext);

  // Pre-select who to call from the "?call=" query param, e.g.
  // /pudu_1?call=pudu_2 opens with pudu_2 already chosen.
  const [targetUserId, setTargetUserId] = useState(() =>
    currentUser ? getCallTarget(currentUser.id) : ""
  );

  // Auto-dial the "?call=" target once, as soon as our own camera/mic
  // stream is ready. Lets a launcher link like /pudu_1?call=pudu_2 place
  // the call without the user pressing anything. Guarded so a re-render
  // never dials twice.
  const autoDialTarget = useRef(
    currentUser ? getCallTarget(currentUser.id) : ""
  );
  useEffect(() => {
    if (autoDialTarget.current && userStream && !isCallAccepted) {
      const target = autoDialTarget.current;
      autoDialTarget.current = "";
      callUser(target);
    }
  }, [userStream, isCallAccepted, callUser]);

  // Hide the lobby once a call is connected.
  if (isCallAccepted) return null;

  // The URL doesn't match any caller (e.g. the bare "/" root): show the
  // personal links so the visitor knows where to go.
  if (!currentUser) {
    return (
      <div className="form-section">
        <Card className="card">
          <h5 className="form-label">Open your personal link</h5>
          <ul className="caller-links">
            {callers.map((caller) => (
              <li key={caller.id}>
                <a href={caller.url}>{caller.name}</a>
                <span className="caller-link-url">{caller.url}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    );
  }

  return (
    <div className="form-section">
      <Card className="card">
        <Form noValidate autoComplete="off">
          <Form.Group controlId="name">
            <Form.Label className="form-label">Your Name</Form.Label>
            <Form.Control
              type="text"
              value={name}
              className="form-input"
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
            />
          </Form.Group>

          <Form.Group controlId="callTarget" className="mt-3">
            <Form.Label className="form-label">Who do you want to call?</Form.Label>
            <Form.Select
              className="form-input"
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
            >
              <option value="">Select a person…</option>
              {callableUsers.map((caller) => {
                const online = onlineUsers.includes(caller.id);
                return (
                  <option key={caller.id} value={caller.id} disabled={!online}>
                    {caller.name} {online ? "(online)" : "(offline)"}
                  </option>
                );
              })}
            </Form.Select>
          </Form.Group>

          <Button
            className="form-main-btn"
            disabled={!targetUserId}
            onClick={() => callUser(targetUserId)}
          >
            <MdCall size={22} /> Call
          </Button>
        </Form>
      </Card>
    </div>
  );
};

export default FormCard;
