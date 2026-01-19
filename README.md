# SolveSphere AI

A voice-based customer support system powered by Ultravox AI, featuring real-time call management, escalation handling, and comprehensive analytics dashboard.

## 🎥 Demonstration Video

<div align="center">

<a href="Debuggers_P1.mp4">
  <img src="https://img.shields.io/badge/▶️-Watch%20Demo%20Video-667eea?style=for-the-badge&logo=video&logoColor=white" alt="Watch Demo Video" style="margin: 20px 0;"/>
</a>

<br>

<a href="Debuggers_P1.mp4" style="text-decoration: none; display: inline-block;">
  <div style="
    width: 100%;
    max-width: 800px;
    height: 450px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    margin: 20px auto;
    position: relative;
    overflow: hidden;
    cursor: pointer;
  ">
    <!-- Play Button Icon -->
    <div style="
      font-size: 80px;
      color: white;
      text-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
      margin-bottom: 20px;
    ">▶️</div>
    
    <!-- Video Title -->
    <div style="
      color: white;
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 10px;
      text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    ">SolveSphere AI Demonstration</div>
    
    <!-- Subtitle -->
    <div style="
      color: rgba(255, 255, 255, 0.9);
      font-size: 16px;
      text-shadow: 0 2px 5px rgba(0, 0, 0, 0.3);
    ">Click to watch the full video</div>
    
    <!-- HD Badge -->
    <div style="
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      padding: 8px 15px;
      border-radius: 20px;
      color: white;
      font-size: 12px;
      font-weight: bold;
      border: 1px solid rgba(255, 255, 255, 0.3);
    ">HD VIDEO</div>
    
    <!-- Duration/Info Badge -->
    <div style="
      position: absolute;
      bottom: 20px;
      left: 20px;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(10px);
      padding: 8px 15px;
      border-radius: 20px;
      color: white;
      font-size: 12px;
      border: 1px solid rgba(255, 255, 255, 0.2);
    ">📹 Full Demo</div>
    
  </div>
</a>

**👉 Click the video tile above to watch the demonstration!**

</div>

## 🚀 Features

- **Voice-Based Support**: Real-time voice interactions using Ultravox AI
- **Call Management**: Create, track, and manage customer support calls
- **Escalation System**: Automatic escalation to human agents when needed
- **Analytics Dashboard**: Real-time statistics, call history, and engagement metrics
- **Webhook Integration**: Real-time event tracking and call status updates

## 📋 Prerequisites

- Python 3.8+
- Ultravox API credentials
- Node.js (for frontend, if needed)

## ⚙️ Setup

1. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure environment variables**:
   Create a `.env` file in the root directory:
   ```env
   ULTRAVOX_API_KEY=your_api_key
   ULTRAVOX_AGENT_ID=your_agent_id
   ULTRAVOX_API_BASE=https://api.ultravox.ai/api
   HOST=0.0.0.0
   PORT=8000
   WEBHOOK_BASE_URL=http://localhost:8000
   ```

3. **Start the server**:
   ```bash
   cd backend
   python main.py
   ```

4. **Access the dashboard**:
   Open your browser and navigate to `http://localhost:8000`

## 📁 Project Structure

```
Hackathon-Tcs/
├── backend/              # FastAPI backend server
│   ├── main.py          # Main application entry point
│   ├── config.py        # Configuration management
│   └── database.py      # Database operations
├── frontend/            # Web dashboard
│   ├── index.html       # Main HTML file
│   ├── app.js          # Frontend JavaScript
│   └── styles.css      # Styling
├── Debuggers_P1.mp4    # Demonstration video
└── requirements.txt    # Python dependencies
```

## 🔧 API Endpoints

- `POST /api/calls` - Create a new call
- `GET /api/calls` - List all calls
- `GET /api/calls/{call_id}` - Get call details
- `POST /api/webhook` - Receive webhook events from Ultravox
- `POST /api/tools/escalate_to_human` - Escalate call to human agent
- `POST /api/tools/log_call_engagement` - Log call engagement metrics

## 📊 Dashboard Features

- **Start New Call**: Initiate voice support sessions
- **Live Statistics**: Real-time call metrics and analytics
- **Call History**: Complete history of all support calls
- **Escalations**: Track and manage escalated calls
- **Engagement Logs**: Monitor customer engagement metrics
- **Webhook Activity**: View real-time webhook events

## 🛠️ Technologies Used

- **Backend**: FastAPI, Python, SQLite
- **Frontend**: HTML, CSS, JavaScript
- **Voice AI**: Ultravox API
- **Database**: SQLite (ultravox.db)

## 📝 License

This project was developed for the TCS Hackathon.
