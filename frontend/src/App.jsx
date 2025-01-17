import React, { useEffect, useState } from 'react';

const LineGraph = () => {
    const [graphUrl, setGraphUrl] = useState(null);

    useEffect(() => {
        // Fetch the graph image
        setGraphUrl('http://127.0.0.1:5000/line-graph'); // Update with Flask backend URL
    }, []);

    return (
        <div>
            <h1>Line Graph</h1>
            {graphUrl ? (
                <img src={graphUrl} alt="Line Graph" />
            ) : (
                <p>Loading graph...</p>
            )}
        </div>
    );
};

export default LineGraph;