import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      setData({
        timestamp: new Date().toISOString(),
        random: Math.random(),
        count: count
      })
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [count])

  return (
    <div className="App">
      <div>
        <h1>Cliente 2 - React Application</h1>
        <div className="card">
          <button onClick={() => setCount((count) => count + 1)}>
            count is {count}
          </button>
          <button onClick={fetchData} disabled={loading}>
            {loading ? 'Loading...' : 'Fetch Data'}
          </button>
        </div>
        
        {data && (
          <div className="data-display">
            <h3>Data:</h3>
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </div>
        )}
        
        <p className="read-the-docs">
          This is a sample React application for monitoring demonstration.
        </p>
      </div>
    </div>
  )
}

export default App