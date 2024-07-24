import React, { useState } from 'react';

const CollapsibleSpan = ({ children }) => {
  const [isOpen, setIsOpen] = useState(true);

  const toggleVisibility = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div class="show">
      <button onClick={toggleVisibility}>
        {isOpen ? 'Minimize' : 'Open'}
      </button>
      <br/>
      {isOpen && (
        <span className="collapsible-content">
          {children}
        </span>
      )}
    </div>
  );
};

export default CollapsibleSpan;
