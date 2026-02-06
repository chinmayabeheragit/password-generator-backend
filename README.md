# Password Generator Backend API

A robust REST API for generating secure passwords with MongoDB persistence.

## Features

- 🔐 Secure password generation with customizable options
- 📊 Password history tracking
- 📈 Statistics and analytics
- 💾 MongoDB database integration
- 🔒 TypeScript for type safety
- ⚡ Express.js framework

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (v6 or higher)
- npm or yarn

## Installation
```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your settings
```

## Environment Variables
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/password-generator
CLIENT_URL=http://localhost:5173
```

## Running the Server
```bash
# Development mode (with hot reload)
npm run dev

# Production build
npm run build
npm start
```

## API Endpoints

### Generate Password
```http
POST /api/passwords/generate
Content-Type: application/json

{
  "length": 16,
  "options": {
    "upper": true,
    "lower": true,
    "numbers": true,
    "symbols": true
  }
}
```

### Get History
```http
GET /api/passwords/history?limit=20&page=1
```

### Get Statistics
```http
GET /api/passwords/stats
```

### Clear History
```http
DELETE /api/passwords/history
```

### Delete Specific Password
```http
DELETE /api/passwords/:id
```

### Health Check
```http
GET /api/health
```

## Project Structure
```
src/
├── config/         # Configuration files
├── controllers/    # Request handlers
├── models/         # Database models
├── routes/         # API routes
├── services/       # Business logic
├── middleware/     # Custom middleware
└── index.ts        # Entry point
```

## Response Format

Success:
```json
{
  "success": true,
  "data": { ... }
}
```

Error:
```json
{
  "success": false,
  "error": "Error message"
}
```

## Technologies

- Express.js - Web framework
- TypeScript - Type safety
- MongoDB - Database
- Mongoose - ODM
- CORS - Cross-origin requests

## License

MIT