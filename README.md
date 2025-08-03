# FoodConnect Malaysia - Production MVP

A complete, production-ready web platform connecting Malaysian restaurants with food influencers. This marketplace allows restaurants to post food collaboration campaigns and influencers to apply and create content for payment.

## 🚀 Features

### Core Functionality
- **User Authentication**: Secure JWT-based authentication with role-based access
- **Restaurant Profiles**: Complete business profiles with image uploads
- **Influencer Profiles**: Portfolio showcases with Instagram integration
- **Campaign Management**: Create, manage, and track collaboration campaigns
- **Application System**: Influencers can apply to campaigns with approval workflow
- **Commission Tracking**: Automated commission calculation and payment tracking
- **Email Notifications**: Automated email notifications for key actions

### Security & Performance
- **Production Security**: Helmet.js, rate limiting, input validation
- **File Upload Security**: Secure image upload with validation
- **Database Security**: Parameterized queries, proper indexing
- **Production Ready**: Docker containerization, Nginx proxy, SSL support

## 🛠 Tech Stack

- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL with proper schemas and relationships
- **Frontend**: Server-side rendered HTML with responsive CSS (Bootstrap)
- **Authentication**: JWT-based with bcrypt password hashing
- **File Upload**: Multer for secure image handling
- **Email**: Nodemailer with Gmail SMTP
- **Security**: Helmet.js, rate limiting, input validation
- **Deployment**: Docker, Nginx, PM2 process management

## 📋 Prerequisites

- Node.js 18+ 
- PostgreSQL 15+
- npm or yarn
- Docker and Docker Compose (for containerized deployment)

## 🚀 Quick Start

### Local Development

1. **Clone and install dependencies**
   ```bash
   git clone <repository-url>
   cd foodconnect-malaysia
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set up database**
   ```bash
   # Create PostgreSQL database
   createdb foodconnect_malaysia
   
   # Run migrations
   npm run migrate
   
   # Optional: Seed with test data
   npm run migrate:seed
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

### Docker Deployment

1. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Configure production values
   ```

2. **Deploy with Docker Compose**
   ```bash
   docker-compose up -d
   ```

3. **Run database migrations**
   ```bash
   docker-compose exec app npm run migrate
   ```

## 🗄 Database Schema

### Core Tables
- **users**: Shared authentication for restaurants and influencers
- **restaurants**: Restaurant business profiles and details
- **influencers**: Influencer profiles with portfolio management
- **campaigns**: Restaurant collaboration campaigns
- **applications**: Influencer applications to campaigns
- **commissions**: Commission tracking and payment management

### Key Features
- **Proper Relationships**: Foreign keys with cascade deletions
- **Indexing**: Optimized queries with strategic indexes
- **Triggers**: Automatic timestamp updates
- **Enums**: Type safety with PostgreSQL enums

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - User logout

### Restaurant Management
- `POST /api/restaurants/profile` - Create restaurant profile
- `GET /api/restaurants/profile` - Get own restaurant profile
- `PUT /api/restaurants/profile` - Update restaurant profile
- `GET /api/restaurants` - List all restaurants
- `GET /api/restaurants/:id` - Get restaurant by ID

### Influencer Management
- `POST /api/influencers/profile` - Create influencer profile
- `GET /api/influencers/profile` - Get own influencer profile
- `PUT /api/influencers/profile` - Update influencer profile
- `GET /api/influencers` - List all influencers
- `GET /api/influencers/:id` - Get influencer by ID

### Campaign Management
- `POST /api/campaigns` - Create campaign (restaurants)
- `GET /api/campaigns` - List all campaigns
- `GET /api/campaigns/my-campaigns` - Get restaurant's campaigns
- `GET /api/campaigns/:id` - Get campaign details
- `PUT /api/campaigns/:id` - Update campaign
- `POST /api/campaigns/:id/close` - Close campaign
- `POST /api/campaigns/:id/complete` - Complete campaign

### Application Management
- `POST /api/applications/campaigns/:campaignId/apply` - Apply to campaign
- `GET /api/applications/my-applications` - Get influencer's applications
- `GET /api/applications/campaigns/:campaignId` - Get campaign applications
- `PUT /api/applications/:id/status` - Update application status

### Commission Management
- `GET /api/commissions` - Get restaurant commissions
- `PUT /api/commissions/:id/status` - Update commission status
- `GET /api/commissions/stats` - Get commission statistics
- `GET /api/commissions/export` - Export commissions to CSV

## 🔧 Configuration

### Environment Variables

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=foodconnect_malaysia
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=7d

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# File Upload Configuration
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./src/public/uploads

# Commission Configuration
DEFAULT_COMMISSION_RATE=15.00
```

## 🚀 Production Deployment

### Using Docker (Recommended)

1. **Build and deploy**
   ```bash
   npm run docker:build
   npm run docker:run
   ```

2. **SSL Setup**
   - Place SSL certificates in `./ssl/` directory
   - Update `nginx.conf` with your domain

### Using PM2

1. **Install PM2 globally**
   ```bash
   npm install -g pm2
   ```

2. **Deploy with PM2**
   ```bash
   npm run production:pm2
   ```

### Manual Deployment

1. **Set production environment**
   ```bash
   export NODE_ENV=production
   ```

2. **Run migrations**
   ```bash
   npm run migrate
   ```

3. **Start application**
   ```bash
   npm run production:start
   ```

## 📊 Monitoring & Maintenance

### Health Check
- `GET /api/health` - Application health status

### Logging
- Application logs: `./logs/`
- Nginx logs: Available in Docker container
- Database logs: PostgreSQL container logs

### Performance Monitoring
- Rate limiting: 100 requests per 15 minutes per IP
- File upload limits: 5MB per file, 10 files max
- Database connection pooling: 20 connections max

## 🔒 Security Features

- **Helmet.js**: Security headers and protection
- **Rate Limiting**: API and upload endpoint protection
- **Input Validation**: Comprehensive request validation
- **File Upload Security**: Type and size restrictions
- **JWT Security**: Secure token generation and validation
- **Password Security**: bcrypt hashing with salt rounds
- **SQL Injection Protection**: Parameterized queries
- **CORS Configuration**: Controlled cross-origin requests

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Issues**
   ```bash
   # Check PostgreSQL status
   sudo systemctl status postgresql
   
   # Restart PostgreSQL
   sudo systemctl restart postgresql
   ```

2. **File Upload Issues**
   ```bash
   # Check uploads directory permissions
   chmod 755 src/public/uploads/
   ```

3. **Email Issues**
   - Verify Gmail app password setup
   - Check firewall settings for SMTP ports

### Development Tips

1. **Reset Database**
   ```bash
   dropdb foodconnect_malaysia
   createdb foodconnect_malaysia
   npm run migrate:seed
   ```

2. **View Logs**
   ```bash
   # PM2 logs
   pm2 logs foodconnect-malaysia
   
   # Docker logs
   npm run docker:logs
   ```

## 📄 License

This project is licensed under the ISC License.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 Support

For support, email support@foodconnect.my or join our Slack channel.

---

**FoodConnect Malaysia** - Connecting restaurants with food influencers across Malaysia. 🇲🇾