// src/components/Lightbox.jsx

import React from 'react';
import './Lightbox.css';

const Lightbox = ({ message, onClose }) => {
  return (
    <div className="lightbox">
      <div className="lightbox-content">
        <p>{message}</p>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default Lightbox;
