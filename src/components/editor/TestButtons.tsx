import React from 'react';

const TestButtons: React.FC = () => {
  const handleClick1 = () => {
    console.log('Test button 1 clicked!');
    alert('Test button 1 clicked!');
  };

  const handleClick2 = () => {
    console.log('Test button 2 clicked!');
    alert('Test button 2 clicked!');
  };

  return (
    <div style={{ 
        marginTop: '20px',
        padding: '20px', 
        border: '2px solid red', 
        borderRadius: '8px',
        backgroundColor: '#fff8f8'
    }}>
      <h3 style={{ marginBottom: '10px', color: 'red' }}>
        Test Buttons (Click These!)
      </h3>
      
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={handleClick1}
          style={{
            padding: '10px 20px',
            backgroundColor: 'blue',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Test Button 1
        </button>
        
        <button
          onClick={handleClick2}
          style={{
            padding: '10px 20px',
            backgroundColor: 'green',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Test Button 2
        </button>
      </div>
    </div>
  );
};

export default TestButtons;
