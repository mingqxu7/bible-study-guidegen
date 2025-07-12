# Deployment Guide

This guide covers deploying the Bible Study Guide Generator to both Vercel and Render.

## Option 1: Vercel Deployment (Recommended)

Vercel will host both frontend and backend in a single deployment.

### Prerequisites
- Vercel account (free at vercel.com)
- GitHub repository connected to Vercel

### Setup Steps

1. **Connect GitHub Repository**
   - Go to [vercel.com](https://vercel.com)
   - Click "Import Project"
   - Select your GitHub repository

2. **Configure Environment Variables**
   In Vercel dashboard, add:
   ```
   ANTHROPIC_API_KEY=your_actual_api_key_here
   MAX_OUTPUT_TOKENS=16000
   MAX_COMMENTARIES=3
   ```

3. **Deploy**
   - Vercel will automatically detect the configuration
   - Click "Deploy"
   - Your app will be available at `https://your-project.vercel.app`

### How It Works
- Frontend is served from `/frontend/dist`
- API routes in `/api` folder become serverless functions
- No need to set VITE_API_URL (defaults to same domain)
- **Port configuration**: Not needed for Vercel - serverless functions handle routing automatically
- Frontend requests to `/api/*` are automatically routed to the corresponding serverless functions

## Option 2: Render Deployment

Render will host frontend and backend as separate services.

### Prerequisites
- Render account (free at render.com)
- GitHub repository connected to Render

### Setup Steps

1. **Create Backend Service**
   - Go to [render.com](https://render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - Name: `bible-study-backend`
     - Root Directory: `backend`
     - Build Command: `npm install`
     - Start Command: `npm start`
   - Add environment variables:
     ```
     ANTHROPIC_API_KEY=your_actual_api_key_here
     PORT=3001
     MAX_OUTPUT_TOKENS=16000
     MAX_COMMENTARIES=3
     ```

2. **Create Frontend Service**
   - Click "New +" → "Static Site"
   - Connect same repository
   - Configure:
     - Name: `bible-study-frontend`
     - Root Directory: `frontend`
     - Build Command: `npm install && npm run build`
     - Publish Directory: `dist`
   - Add environment variable:
     ```
     VITE_API_URL=https://bible-study-backend.onrender.com/api
     ```
     (Replace with your actual backend URL)

3. **Deploy**
   - Both services will deploy automatically
   - Frontend: `https://bible-study-frontend.onrender.com`
   - Backend: `https://bible-study-backend.onrender.com`

### Alternative: Blueprint Deployment
Use the `render.yaml` file for one-click deployment:
1. In Render dashboard, click "New +" → "Blueprint"
2. Connect your repository
3. Render will read `render.yaml` and create both services

## Environment Variables Reference

### Backend Variables
- `ANTHROPIC_API_KEY` (required): Your Anthropic API key
- `PORT`: Server port (default: 3001)
- `MAX_OUTPUT_TOKENS`: Max tokens for Claude response (default: 16000)
- `MAX_COMMENTARIES`: Max commentaries to fetch (default: 3)

### Frontend Variables
- `VITE_API_URL`: Backend API URL (only needed for Render deployment)

## Post-Deployment

1. **Test the deployment**
   - Visit your frontend URL
   - Select a theological perspective
   - Enter a Bible verse reference
   - Generate a study guide

2. **Monitor logs**
   - Vercel: Check Functions tab in dashboard
   - Render: Check Logs tab for each service

3. **Custom domain**
   - Both Vercel and Render support custom domains
   - Configure in respective dashboards

## Troubleshooting

### API Connection Issues
- Ensure CORS is properly configured (already set in code)
- Check environment variables are set correctly
- Verify API URL in frontend matches backend deployment

### Build Failures
- Check Node.js version compatibility (requires 18+)
- Ensure all dependencies are in package.json
- Review build logs for specific errors

### Performance
- Vercel functions have 10-second timeout by default (configured to 30s)
- Render free tier may sleep after inactivity
- Consider upgrading for production use