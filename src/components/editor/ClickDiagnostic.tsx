import React, { useEffect, useState } from 'react';

const ClickDiagnostic: React.FC = () => {
  const [clickCoords, setClickCoords] = useState<{ x: number; y: number } | null>(null);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  const [overlayActivated, setOverlayActivated] = useState(false);
  
  // Set up event listeners for diagnostic purposes
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      setClickCoords({ x: e.clientX, y: e.clientY });
      
      // Check what element was clicked
      const target = e.target as HTMLElement;
      const path = getElementPath(target);
      console.log('Click path:', path);
      console.log('Click target:', target);
    };
    
    const handleMousemove = (e: MouseEvent) => {
      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
      if (target) {
        const path = getElementPath(target);
        setHoveredElement(`${path} (${e.clientX}, ${e.clientY})`);
      } else {
        setHoveredElement('No element');
      }
    };
    
    document.addEventListener('click', handleClick);
    document.addEventListener('mousemove', handleMousemove);
    
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('mousemove', handleMousemove);
    };
  }, []);
  
  // Helper function to get element path
  const getElementPath = (element: HTMLElement): string => {
    let currentElement: HTMLElement | null = element;
    const path: string[] = [];
    
    while (currentElement && currentElement !== document.body) {
      let elementDesc = currentElement.tagName.toLowerCase();
      
      if (currentElement.id) {
        elementDesc += `#${currentElement.id}`;
      } else if (currentElement.className) {
        const classNames = currentElement.className.split(' ')
          .filter(c => c)
          .map(c => `.${c}`)
          .join('');
        elementDesc += classNames;
      }
      
      path.unshift(elementDesc);
      currentElement = currentElement.parentElement;
    }
    
    return path.join(' > ');
  };
  
  // Check for overlapping elements
  const checkOverlappingElements = () => {
    setOverlayActivated(true);
    
    // Create a temporary element that acts as a clickable surface at the position of the buttons
    const buttons = document.querySelectorAll('button, .cursor-pointer');
    buttons.forEach((button, index) => {
      const rect = button.getBoundingClientRect();
      
      const testElement = document.createElement('div');
      testElement.style.position = 'fixed';
      testElement.style.left = `${rect.left}px`;
      testElement.style.top = `${rect.top}px`;
      testElement.style.width = `${rect.width}px`;
      testElement.style.height = `${rect.height}px`;
      testElement.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
      testElement.style.zIndex = '9999';
      testElement.style.pointerEvents = 'auto';
      testElement.style.cursor = 'pointer';
      testElement.textContent = `Test ${index}`;
      
      testElement.addEventListener('click', () => {
        alert(`Test element ${index} clicked - this indicates the button is being blocked`);
      });
      
      document.body.appendChild(testElement);
      
      // Remove after 10 seconds
      setTimeout(() => {
        document.body.removeChild(testElement);
        if (index === buttons.length - 1) {
          setOverlayActivated(false);
        }
      }, 10000);
    });
  };
  
  const findInvisibleOverlays = () => {
    // Temporarily style all elements to show borders
    const style = document.createElement('style');
    style.id = 'diagnostic-style';
    style.innerHTML = `
      * {
        outline: 1px solid rgba(255, 0, 0, 0.2) !important;
      }
      
      div, section, article {
        position: relative;
      }
      
      div::after, section::after, article::after {
        content: attr(class);
        position: absolute;
        top: 0;
        left: 0;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        font-size: 10px;
        padding: 2px;
        z-index: 9999;
        pointer-events: none;
      }
    `;
    
    document.head.appendChild(style);
    
    // Remove after 10 seconds
    setTimeout(() => {
      const diagStyle = document.getElementById('diagnostic-style');
      if (diagStyle) {
        document.head.removeChild(diagStyle);
      }
    }, 10000);
  };
  
  return (
    <div className="fixed bottom-0 left-0 z-50 bg-black bg-opacity-80 text-white p-4 max-w-md text-xs">
      <div className="mb-2">
        <strong>Click Diagnostics</strong>
        <div>{clickCoords ? `Last click: (${clickCoords.x}, ${clickCoords.y})` : 'No clicks yet'}</div>
        <div className="truncate">{hoveredElement || 'No element hovered'}</div>
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={checkOverlappingElements}
          disabled={overlayActivated}
          className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs"
        >
          Check Overlapping
        </button>
        
        <button
          onClick={findInvisibleOverlays}
          className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs"
        >
          Show Layouts
        </button>
      </div>
    </div>
  );
};

export default ClickDiagnostic;
