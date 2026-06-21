# StudyFlow

StudyFlow is a fully-functional, mobile-first, and beautifully designed Student Task and Productivity Tracker. It helps students manage assignments, track deadlines, organize subjects, and monitor overall productivity in a visually stunning interface inspired by Notion, Linear, and Todoist.

## Features

- **Dashboard Analytics**: Beautiful charts powered by Chart.js (Productivity Rings, Weekly Activity Bars, Subject Breakdowns).
- **Task Management**: Create, edit, delete, and mark tasks as complete with smooth micro-animations.
- **Smart Filtering**: Filter tasks by priority (High, Medium, Low), due date, or status.
- **Subject Organization**: Group tasks by color-coded and icon-labeled subjects.
- **Daily Motivation**: A rotating set of motivational quotes to keep you focused.
- **Themes**: Light mode (default) and Dark mode with seamless toggle.
- **Real Database Persistence**: A built-in Node.js backend using SQLite ensures all your tasks and data are permanently saved locally.

## Tech Stack

- **Frontend**: HTML5, CSS3 (Custom Variables & Glassmorphism), Vanilla JavaScript (ES6+).
- **Backend**: Node.js, Express.js.
- **Database**: SQLite.
- **Libraries**: Chart.js (for analytics).

## Getting Started

### Prerequisites

You need to have [Node.js](https://nodejs.org/) installed on your computer to run the backend server.

### Installation & Running Locally

1. **Navigate to the project directory**:
   Ensure you are in the `studyflow` folder.

2. **Install dependencies**:
   Run the following command to install the required Node.js packages (Express, SQLite3, CORS):
   ```bash
   npm install
   ```

3. **Start the backend server**:
   Run the server using Node:
   ```bash
   npm start
   ```
   *Note: This will start the server on `http://localhost:3000` and automatically create the local `studyflow.db` database file.*

4. **Open the app**:
   Open your preferred web browser and navigate to:
   **[http://localhost:3000](http://localhost:3000)**

## Project Structure

```text
studyflow/
├── css/
│   ├── animations.css    # CSS keyframes and micro-interactions
│   └── styles.css        # Main stylesheet, themes, and layouts
├── js/
│   ├── app.js            # Main initialization and saving logic
│   ├── charts.js         # Chart.js configuration and rendering
│   ├── data.js           # API communication and state management
│   ├── quotes.js         # Motivational quotes rotation
│   ├── subjects.js       # Subject UI rendering
│   ├── tasks.js          # Task UI rendering and filtering
│   └── ui.js             # UI event listeners, tabs, and modals
├── index.html            # Main SPA HTML structure
├── package.json          # Node dependencies and scripts
├── server.js             # Express.js backend and SQLite setup
└── README.md             # This documentation file
```

## Future Enhancements

- User authentication (Google Sign-In)
- Pomodoro timer integration
- Calendar synchronization
- Push notifications for due dates
