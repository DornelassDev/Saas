from flask import Flask, jsonify, request
import psutil
import time
import random
import os
from datetime import datetime

# Auto-injected monitoring will be added here by the monitoring agent

app = Flask(__name__)
PORT = int(os.getenv('PORT', 5000))

@app.route('/')
def home():
    return jsonify({
        'message': 'Hello from Cliente 3 - Flask App!',
        'timestamp': datetime.now().isoformat(),
        'project': 'cliente3'
    })

@app.route('/health')
def health():
    return jsonify({
        'status': 'healthy',
        'uptime': time.time() - psutil.Process().create_time(),
        'memory_percent': psutil.Process().memory_percent(),
        'cpu_percent': psutil.Process().cpu_percent(),
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/data')
def get_data():
    # Simulate some data processing
    time.sleep(random.uniform(0.1, 0.5))  # Simulate processing time
    
    data = {
        'customers': random.randint(100, 1000),
        'sales': random.randint(50, 500),
        'profit': random.randint(1000, 10000),
        'timestamp': datetime.now().isoformat()
    }
    
    return jsonify(data)

@app.route('/api/slow')
def slow_endpoint():
    # Simulate slow endpoint
    time.sleep(random.uniform(1, 3))
    return jsonify({
        'message': 'This was a slow request from Flask',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/error')
def error_endpoint():
    # Simulate error for testing
    if random.random() > 0.5:
        raise Exception('Random error for testing from Flask')
    return jsonify({'message': 'Success from Flask!'})

@app.route('/api/system')
def system_info():
    return jsonify({
        'cpu_percent': psutil.cpu_percent(interval=1),
        'memory': dict(psutil.virtual_memory()._asdict()),
        'disk': dict(psutil.disk_usage('/')._asdict()),
        'network': dict(psutil.net_io_counters()._asdict()),
        'timestamp': datetime.now().isoformat()
    })

@app.errorhandler(Exception)
def handle_error(error):
    return jsonify({'error': str(error)}), 500

if __name__ == '__main__':
    print(f'Cliente 3 Flask app starting on port {PORT}')
    app.run(host='0.0.0.0', port=PORT, debug=True)