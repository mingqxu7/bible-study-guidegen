# Bible Study Guide Generator

A comprehensive web application that generates theologically-informed Bible study guides for cell group ministry. The application features a React frontend and Express backend that integrates with Claude AI to create detailed study materials.

## Features

- **Theological Perspectives**: Choose from major theological stances (Reformed, Arminian, Dispensationalist, Lutheran, Catholic)
- **Comprehensive Study Guides**: Generates detailed guides with verse-by-verse exegesis, discussion questions, and life applications
- **Expert Commentary**: Draws from respected biblical commentaries and scholarship
- **Downloadable Content**: Export study guides as text files for offline use
- **Group-Ready**: Designed specifically for cell group leaders and Bible study facilitators

## Project Structure

```
bible-study-guide-generator/
├── backend/                 # Express.js API server
│   ├── server.js           # Main server file
│   ├── package.json        # Backend dependencies
│   └── .env.example        # Environment variables template
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── BibleStudyCreator.jsx  # Main React component
│   │   ├── main.jsx        # React entry point
│   │   └── index.css       # Tailwind CSS imports
│   ├── index.html          # HTML template
│   ├── package.json        # Frontend dependencies
│   ├── vite.config.js      # Vite configuration
│   ├── tailwind.config.js  # Tailwind CSS configuration
│   └── postcss.config.js   # PostCSS configuration
└── README.md               # This file
```

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Anthropic API key

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.example .env
   ```

4. Add your Anthropic API key to the `.env` file:
   ```
   ANTHROPIC_API_KEY=your_actual_api_key_here
   PORT=3001
   ```

5. Start the backend server:
   ```bash
   npm run dev
   ```

The backend server will run on `http://localhost:3001`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The frontend will run on `http://localhost:3000`

## Usage

1. **Select Theological Perspective**: Choose from the available theological stances that best aligns with your church's beliefs
2. **Enter Bible Passage**: Input the passage you want to study (e.g., "Matthew 5:1-12", "John 3:16", "Romans 8:28-39")
3. **Generate Study Guide**: Click the generate button to create a comprehensive study guide
4. **Download**: Use the download button to save the study guide as a text file

## API Endpoints

### POST /api/generate-study
Generates a Bible study guide based on the provided passage and theological perspective.

**Request Body:**
```json
{
  "verseInput": "John 3:16",
  "selectedTheology": "calvinism",
  "theologicalStances": [...]
}
```

**Response:**
```json
{
  "title": "Study title",
  "passage": "John 3:16",
  "theology": "Reformed/Calvinist",
  "overview": {...},
  "exegesis": [...],
  "discussionQuestions": [...],
  "lifeApplication": {...},
  "additionalResources": {...}
}
```

### GET /api/health
Health check endpoint to verify the API is running.

## Getting an Anthropic API Key

1. Visit [Anthropic's website](https://www.anthropic.com/)
2. Sign up for an account
3. Navigate to the API section
4. Generate a new API key
5. Add the key to your `.env` file

## Technologies Used

### Frontend
- React 18
- Vite (build tool)
- Tailwind CSS (styling)
- Lucide React (icons)

### Backend
- Express.js (web framework)
- Anthropic SDK (Claude AI integration)
- CORS (cross-origin resource sharing)
- dotenv (environment variables)

## Development

### Backend Development
```bash
cd backend
npm run dev  # Uses nodemon for auto-restart
```

### Frontend Development
```bash
cd frontend
npm run dev  # Uses Vite for hot module replacement
```

### Building for Production

#### Frontend
```bash
cd frontend
npm run build
```

#### Backend
The backend runs directly with Node.js - no build step required.

## License

This project is intended for educational and ministry purposes. Please ensure you comply with Anthropic's usage policies when using the Claude API.

## Support

For questions or issues, please refer to the documentation or create an issue in the project repository.