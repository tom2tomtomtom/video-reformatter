import React from 'react';

const DirectHTMLButtons: React.FC = () => {
  const handleOnclick = (buttonName: string) => {
    alert(`${buttonName} button clicked!`);
    console.log(`${buttonName} button clicked!`);
  };

  return (
    <div style={{
      border: '3px solid red',
      padding: '20px',
      margin: '20px 0',
      backgroundColor: '#ffeeee',
      position: 'relative',
      zIndex: 1000,
    }}>
      <h3 style={{ fontWeight: 'bold', marginBottom: '15px' }}>
        Direct HTML Buttons - Try These (z-index: 1000)
      </h3>
      
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '10px' 
      }}>
        <a 
          href="#" 
          onClick={(e) => { e.preventDefault(); handleOnclick('HTML Link'); }}
          style={{ 
            backgroundColor: 'blue', 
            color: 'white', 
            padding: '10px 20px', 
            borderRadius: '5px',
            textDecoration: 'none',
            display: 'inline-block',
            position: 'relative',
            zIndex: 1000
          }}
        >
          HTML Link
        </a>
        
        <button 
          onClick={() => handleOnclick('HTML Button')}
          style={{ 
            backgroundColor: 'green', 
            color: 'white', 
            padding: '10px 20px', 
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            position: 'relative',
            zIndex: 1000
          }}
        >
          HTML Button
        </button>
        
        <input 
          type="button" 
          value="Input Button" 
          onClick={() => handleOnclick('Input Button')}
          style={{ 
            backgroundColor: 'purple', 
            color: 'white', 
            padding: '10px 20px', 
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            position: 'relative',
            zIndex: 1000
          }}
        />
      </div>
      
      <div style={{ 
        display: 'flex', 
        gap: '10px' 
      }}>
        <div
          onClick={() => handleOnclick('Div as Button')}
          style={{ 
            backgroundColor: 'orange', 
            color: 'white', 
            padding: '10px 20px', 
            borderRadius: '5px',
            cursor: 'pointer',
            userSelect: 'none',
            position: 'relative',
            zIndex: 1000
          }}
        >
          Div as Button
        </div>
        
        <span
          onClick={() => handleOnclick('Span as Button')}
          style={{ 
            backgroundColor: 'brown', 
            color: 'white', 
            padding: '10px 20px', 
            borderRadius: '5px',
            cursor: 'pointer',
            userSelect: 'none',
            display: 'inline-block',
            position: 'relative',
            zIndex: 1000
          }}
        >
          Span as Button
        </span>
      </div>
      
      <div style={{ marginTop: '15px', fontSize: '14px' }}>
        Click any of these elements. If they work, but not the other buttons in the app, 
        we'll know the issue is specific to the components.
      </div>
    </div>
  );
};

export default DirectHTMLButtons;