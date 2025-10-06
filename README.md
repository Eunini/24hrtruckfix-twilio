# Service Provider Backend

A RESTful API service for managing service providers, built with Express.js and MongoDB.

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Redis
- AWS Account (for S3 storage)

## Setup

1. Clone the repository
```bash
git clone <repository-url>
cd service-provider-backend
```

2. Install dependencies
```bash
npm install
```

3. Environment Variables
Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/service-provider

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Configuration
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name

# Email Configuration
EMAIL_FROM=noreply@example.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password

# Twilio Configuration
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=your-phone-number
```

4. Start the server
```bash
# Development
npm run dev

# Production
npm run prod
```

## API Endpoints

### Authentication
- POST /api/auth/login - User login
- POST /api/auth/register - User registration
- POST /api/auth/logout - User logout
- POST /api/auth/verify-2fa - Verify 2FA token
- POST /api/auth/forgot-password - Request password reset
- POST /api/auth/reset-password - Reset password
- POST /api/auth/confirm-code - Confirm verification code
- POST /api/auth/resend-code - Resend verification code

### Profile
- GET /api/auth/profile - Get user profile
- PUT /api/auth/profile - Update user profile
- POST /api/auth/profile/image - Upload profile image

### Users
- GET /api/auth/users - List all users
- GET /api/auth/users/:id - Get user by ID
- PUT /api/auth/users/:id - Update user
- DELETE /api/auth/users/:id - Delete user

### Teams
- GET /api/teams - Get all teams
- POST /api/teams/sync - Sync teams

### Tasks
- GET /api/tasks - Get all tasks
- GET /api/tasks/templates - Get task templates

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 
