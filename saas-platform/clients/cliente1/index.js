const express = require('express');
const cors = require('cors');

// Auto-injected monitoring will be added here by the monitoring agent

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Hello from Cliente 1!', 
    timestamp: new Date().toISOString(),
    project: 'cliente1'
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/data', (req, res) => {
  // Simulate some data processing
  const data = {
    users: Math.floor(Math.random() * 1000),
    orders: Math.floor(Math.random() * 500),
    revenue: Math.floor(Math.random() * 10000),
    timestamp: new Date().toISOString()
  };
  
  res.json(data);
});

app.get('/api/slow', (req, res) => {
  // Simulate slow endpoint
  setTimeout(() => {
    res.json({ message: 'This was a slow request', timestamp: new Date().toISOString() });
  }, Math.random() * 2000 + 1000);
});

app.get('/api/error', (req, res) => {
  // Simulate error for testing
  if (Math.random() > 0.5) {
    throw new Error('Random error for testing');
  }
  res.json({ message: 'Success!' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Cliente 1 app running on port ${PORT}`);
});