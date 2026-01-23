import React, { useState } from 'react';

const App = () => {
    const [display, setDisplay] = useState('0');

    const handleButtonClick = (value) => {
        if (value === 'C') {
            setDisplay('0');
        } else if (value === '=') {
            try {
                setDisplay(eval(display));
            } catch (error) {
                setDisplay('Error');
            }
        } else {
            setDisplay(display === '0' ? value : display + value);
        }
    };

    return (
        <div className="bg-white shadow-md rounded-lg p-5 w-64">
            <input
                type="text"
                className="w-full text-right text-2xl font-semibold p-2 border border-gray-300 rounded mb-4"
                value={display}
                readOnly
            />
            <div className="grid grid-cols-4 gap-2">
                {['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', '0', '.', '=', '+', 'C'].map((item) => (
                    <button
                        key={item}
                        className={`bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded ${
                            ['/', '*', '-', '+', '='].includes(item) ? 'bg-blue-200 hover:bg-blue-300 text-blue-700' : ''
                        } ${item === 'C' ? 'bg-red-200 hover:bg-red-300 text-red-700' : ''}`}
                        onClick={() => handleButtonClick(item)}
                    >
                        {item}
                    </button>
                ))}
            </div>
        </div>
    );
};

ReactDOM.render(<App />, document.getElementById('root'));