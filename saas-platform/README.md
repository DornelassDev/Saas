# SaaS Monitoring Platform

A comprehensive multi-client SaaS monitoring platform with automatic project detection, real-time monitoring, and scalable architecture.

## 🚀 Features

### Core Platform
- **Multi-client SaaS architecture** with automatic project detection
- **Real-time monitoring** with Socket.io for CPU, RAM, uptime, errors
- **JWT authentication** with Google OAuth support
- **Three user levels**: Admin, Master, Client
- **Stripe billing** integration (R$ 150/month)
- **Automatic SDK injection** without code modification

### Monitoring Agent
- **Auto-detects** React, Node.js, Python, Django, Flask projects
- **Sequential port assignment** (3001, 3002, 3003...)
- **Comprehensive metrics collection**: CPU, RAM, uptime, response times, errors
- **Health checks** and auto-restart on crashes
- **Project lifecycle management** (start, stop, restart)

### Dashboard Features
- **Admin Dashboard**: Global view, client management, billing
- **Client Dashboard**: Project-specific metrics and controls
- **Real-time charts** with Chart.js
- **Dark/light theme** support
- **Responsive design** for all devices

### SDK Capabilities
- **HTTP request monitoring**
- **Database query tracking**
- **Error tracking and logging**
- **Custom metrics support**
- **Performance bottleneck detection**
- **Resource usage monitoring**

## 🏗️ Architecture

```
saas-platform/
├── saas-core/           # Main React app (port 3000)
├── monitoring-agent/    # Node.js monitoring service
├── clients/             # Client projects
│   ├── cliente1/        # Node.js/Express project
│   ├── cliente2/        # React project
│   └── cliente3/        # Python/Flask project
├── shared/              # Common libraries
├── config/              # Global configurations
└── docker-compose.yml   # Container orchestration
```

## 🚦 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Git

### 1. Clone and Setup
```bash
git clone <repository>
cd saas-platform
cp saas-core/.env.example saas-core/.env
```

### 2. Configure Environment
Edit `saas-core/.env`:
```env
DATABASE_URL="file:./database/database.db"
JWT_SECRET="your-super-secret-jwt-key"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
STRIPE_SECRET_KEY="sk_test_your_stripe_key"
```

### 3. Start with Docker
```bash
docker-compose up -d
```

### 4. Or Start Locally
```bash
# Install dependencies
npm install

# Start all services
npm run dev
```

### 5. Access the Platform
- **SaaS Core**: http://localhost:3000
- **Client Projects**: http://localhost:3001, 3002, 3003...
- **Monitoring Agent**: http://localhost:3100

## 📊 Monitoring Features

### Automatic Detection
The monitoring agent automatically:
- Scans the `clients/` directory
- Detects project types (React, Node.js, Python, etc.)
- Assigns sequential ports
- Injects monitoring SDK
- Starts projects automatically

### Metrics Collected
- **System**: CPU, Memory, Disk, Network
- **Application**: Request count, Response times, Error rates
- **Custom**: User-defined metrics via SDK
- **Performance**: Database queries, API calls, File I/O

### Real-time Updates
- WebSocket connections for live data
- Automatic reconnection handling
- Namespace separation for multi-tenancy
- Broadcasting to relevant user groups

## 🛡️ Security

- **JWT authentication** with secure token handling
- **Google OAuth** integration
- **RBAC** (Role-Based Access Control)
- **Rate limiting** and CORS protection
- **Input validation** and XSS prevention
- **SQL injection** protection with Prisma
- **HTTPS** support with automatic SSL

## 💳 Billing Integration

- **Stripe** payment processing
- **Monthly subscriptions** (R$ 150/month)
- **Automatic billing** cycles
- **Payment failure** handling
- **Invoice generation**
- **Usage tracking**

## 🔧 Configuration

### Adding New Client Projects
1. Create project folder in `clients/`
2. Add your project files
3. The monitoring agent will auto-detect and start it
4. Monitor via the dashboard

### Supported Project Types
- **React**: Vite, Create React App
- **Node.js**: Express, Koa, Fastify
- **Next.js**: Full-stack React framework
- **Python**: Flask, Django, FastAPI
- **Static**: HTML/CSS/JS sites

### Environment Variables
Each project can have custom environment variables via `.env` files.

## 📈 Scaling

### Horizontal Scaling
- Multiple monitoring agents
- Load balancing with Nginx
- Redis for session storage
- Database replication

### Performance Optimization
- Connection pooling
- Caching strategies
- CDN integration
- Asset optimization

## 🧪 Testing

```bash
# Run tests for SaaS Core
cd saas-core
npm test

# Run tests for Monitoring Agent
cd monitoring-agent
npm test
```

## 📚 API Documentation

### Authentication Endpoints
```
POST /api/auth/login
POST /api/auth/register
GET  /api/auth/google
GET  /api/auth/me
```

### Client Management
```
GET    /api/clients
POST   /api/clients
GET    /api/clients/:id
PUT    /api/clients/:id
DELETE /api/clients/:id
```

### Monitoring Data
```
GET /api/monitoring/dashboard
GET /api/monitoring/clients/:id
GET /api/monitoring/projects/:id
```

## 🐳 Docker Deployment

### Production Deployment
```bash
# Build and deploy
docker-compose -f docker-compose.prod.yml up -d

# Scale monitoring agents
docker-compose scale monitoring-agent=3
```

### Environment-specific Configs
- `docker-compose.yml` - Development
- `docker-compose.prod.yml` - Production
- `docker-compose.test.yml` - Testing

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check this README and inline comments
- **Issues**: Create GitHub issues for bugs
- **Features**: Request features via GitHub discussions
- **Commercial**: Contact for enterprise support

## 🗺️ Roadmap

- [ ] Kubernetes deployment
- [ ] Advanced alerting rules
- [ ] Machine learning anomaly detection
- [ ] Multi-region support
- [ ] Advanced analytics dashboard
- [ ] Mobile app for monitoring
- [ ] Webhook integrations
- [ ] Custom notification channels

---

**Built with ❤️ for modern SaaS monitoring needs**