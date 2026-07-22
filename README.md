# Microsoft Campus Club - KFS Management System (MSC-KFS)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2018.x-blue.svg)](https://nodejs.org)
[![Express.js](https://img.shields.io/badge/express-4.x-lightgrey.svg)](https://expressjs.com)
[![PostgreSQL](https://img.shields.io/badge/postgresql-14%2B-blue.svg)](https://www.postgresql.org)

A professional, role-based management system designed to streamline recruitment, operations, department hierarchy, and student training tracking for the **Microsoft Campus Club at Kafr El-Sheikh University (MSC-KFS)**.

<p align="center">
  <img src="MIC_StudentAmbassadors_Badge_CampusClub_ColorBG.png" alt="Microsoft Student Ambassadors Campus Club logo" width="250">
</p>

---

## 1. System Overview

MSC-KFS is built on a modern, lightweight decoupled architecture:
*   **Backend API:** Node.js/Express REST API backed by an Azure PostgreSQL database.
*   **Frontend Client:** A responsive, lightweight HTML5/CSS3/JS client hosted statically.

*   **Production Frontend:** [https://msckfs.z16.web.core.windows.net](https://msckfs.z16.web.core.windows.net)
*   **Production API:** [https://msc-kfs-api-alaa.azurewebsites.net](https://msc-kfs-api-alaa.azurewebsites.net)

---

## 2. Core Features

### 2.1 Recruitment & Application System
*   **Toggle Registration Windows:** Admins can open/close application windows dynamically for different pathways (e.g., Board, Crew/Member).
*   **Recruitment Funnel:** Prospective students submit applications detailing their skills, track preference, LinkedIn profiles (mandatory), and GitHub (optional).
*   **One-Click Review & Acceptance:** Admins review applicants and make Accept/Reject decisions. Accepting an applicant automatically registers their user profile, generates and sends credentials, and places them into the designated track/group.

### 2.2 Student & Mentor Training Portal
*   **Session Management:** Mentors or track leads post sessions with date, title, and virtual meeting links (Google Meet, Microsoft Teams, etc.).
*   **Attendance Tracking:** Mentors mark member attendance as *Present*, *Absent*, or *Excused*.
*   **Task & Assignment Evaluation:** Mentors assign description-based tasks, students submit their project URLs/work directly in the portal, and mentors grade and leave feedback on each submission.
*   **Student Metrics Dashboard:** Students can view their personal performance metrics, including overall attendance rates, task grades, and mentor feedback.

---

## 3. Scoped RBAC Hierarchy & Visibility Rules

The platform enforces a strict, hierarchical role-based access control (RBAC) mechanism. Users only see resources and members within their authorized scopes:

| Role Code | Scope Type | Allowed Operations & Visibility |
| :--- | :--- | :--- |
| **full_access** | Global | Complete administrative authority. Views, edits, and manages everything globally. |
| **department_director** | Department | Full visibility and control over their department (all units, groups, leaders, mentors, and member rosters). Cannot view other departments. |
| **unit_lead / unit_vice_lead** | Unit (Track) | Access restricted to their unit only. Sees all groups, mentors, and student rosters within their unit. |
| **mentor** | Group | Sees and manages members, attendance, tasks, and grading *only* for students in their assigned group. |
| **member** | Self / Own Group | Sees own profile details, attendance, assigned tasks, and grades. |

---

## 4. Tech Stack

### Backend
*   **Runtime:** Node.js (v18+)
*   **Framework:** Express.js
*   **Security:** Helmet, CORS, bcryptjs, JSON Web Tokens (JWT) for authentication
*   **Database Client:** `pg` (node-postgres)
*   **Mail service:** Nodemailer (for sending student credentials)

### Frontend
*   **Markup & Styles:** HTML5, Vanilla CSS3 (Custom design system with CSS custom properties)
*   **Scripting:** Vanilla Javascript (ES6+) utilizing `fetch` for API communication

### Database
*   **Engine:** PostgreSQL

---

## 5. Directory Structure

```text
├── backend/                       # Node.js/Express API
│   ├── src/
│   │   ├── config/                # Environment configuration
│   │   ├── controllers/           # Request handlers
│   │   ├── middleware/            # JWT auth & RBAC middleware
│   │   ├── routes/                # Express routes mapping
│   │   ├── utils/                 # Email & cryptographic helpers
│   │   ├── app.js                 # Express application initialization
│   │   └── server.js              # Server entry point
│   ├── .env.example               # Template env file
│   └── package.json               # Backend dependencies and scripts
│
├── frontend/                      # Static Web Application Client
│   ├── assets/                    # Shared image assets and logos
│   ├── css/                       # Vanilla CSS stylesheets (styles.css)
│   ├── js/                        # Front-end API wrapper and page controllers
│   ├── index.html                 # Club landing page
│   ├── login.html                 # Portal login page
│   ├── dashboard.html             # Member dashboard portal
│   └── *.html                     # Other application forms and administration panels
│
├── 001_schema.sql                 # Core database schema script
├── 002_seed.sql                   # Initial database seeds
├── 003_dangerous_actions.sql      # Database truncation script (use with caution!)
├── 004_structural_fixes.sql       # Minor schema patches
├── 005_applications.sql           # Schema extensions for the application system
├── 006_board_app_details.sql      # Schema additions for board applications
├── 007_portal_features.sql        # Task evaluation & session tracking schema
├── 008_linkedin_required.sql      # Database constraint enforcement
├── LICENSE                        # MIT Open Source License
├── CONTRIBUTING.md                # Contribution Guidelines
└── README.md                      # Project documentation
```

---

## 6. Installation & Local Setup

### 6.1 Prerequisites
*   [Node.js](https://nodejs.org/) (version 18 or later)
*   [PostgreSQL](https://www.postgresql.org/) (installed and running locally)

### 6.2 Database Initialization
Create a database named `mscc_kfs` in your PostgreSQL instance and execute the SQL scripts in chronological order to set up tables, relationships, constraints, and initial data:

```bash
# Example using psql command-line interface
psql -U postgres -d mscc_kfs -f 001_schema.sql
psql -U postgres -d mscc_kfs -f 002_seed.sql
# Skip 003_dangerous_actions.sql unless reset is needed
psql -U postgres -d mscc_kfs -f 004_structural_fixes.sql
psql -U postgres -d mscc_kfs -f 005_applications.sql
psql -U postgres -d mscc_kfs -f 006_board_app_details.sql
psql -U postgres -d mscc_kfs -f 007_portal_features.sql
psql -U postgres -d mscc_kfs -f 008_linkedin_required.sql
```

### 6.3 Backend Setup
1.  Navigate to the `backend/` directory:
    ```bash
    cd backend
    ```
2.  Copy `.env.example` to `.env`:
    ```bash
    cp .env.example .env
    ```
3.  Configure your environment variables inside the new `.env` file (e.g. database credentials, port, and JWT secret).
4.  Install dependencies:
    ```bash
    npm install
    ```
5.  Start the development server:
    ```bash
    npm run dev
    ```

### 6.4 Frontend Setup
1.  Navigate to the `frontend/` directory.
2.  Open `js/api.js` and set the `API_BASE_URL` to point to your local backend server (usually `http://localhost:4000/api`):
    ```javascript
    const API_BASE_URL = 'http://localhost:4000/api';
    ```
3.  Serve the `frontend/` directory using a simple static web server (such as Live Server in VS Code, or python simple HTTP server):
    ```bash
    # From inside the frontend directory:
    python3 -m http.server 8080
    ```
4.  Open `http://localhost:8080` in your web browser.

---

## 7. Contributing

We welcome contributions from Microsoft Campus Club members and the broader community! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) to learn how to check out the project, propose changes, and adhere to our coding standards.

---

## 8. License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
