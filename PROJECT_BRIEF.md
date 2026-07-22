# Microsoft Campus Club - KFS Management System (MSC-KFS)

A management system designed to streamline recruitment, operations, department hierarchy, and student training tracking for the Microsoft Campus Club at Kafr El-Sheikh University (MSC-KFS).

---

## 1. System Overview

MSC-KFS consists of a Node.js/Express REST API backed by an Azure PostgreSQL database, paired with a vanilla HTML5/JS/CSS client hosted statically.

- **Frontend Application:** [https://msckfs.z16.web.core.windows.net](https://msckfs.z16.web.core.windows.net)
- **Backend API:** [https://msc-kfs-api-alaa.azurewebsites.net](https://msc-kfs-api-alaa.azurewebsites.net)

---

## 2. Core Features

### 2.1 Recruitment & Application System
*   **Toggle Registration Windows:** Admins can open/close application windows for different pathways (e.g., Board, Crew/Member).
*   **Recruitment Funnel:** Prospective students submit applications detailing their skills, track preference, LinkedIn profiles (mandatory), and GitHub (optional).
*   **One-Click Review & Acceptance:** Admins review applicants, rendering an Accept/Reject decision. Accepting an applicant automatically registers their user profile, sends credentials, and places them into the designated track/group.

### 2.2 Student & Mentor Training Portal
*   **Session Management:** Mentors/leads post sessions with date, title, and virtual meeting links (Google Meet, Teams, etc.).
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

## 4. Database Schema

The architecture is built on the following primary tables:
- `users`: User profiles with required fields like English-only full name, email, account status, and LinkedIn URL.
- `roles` / `permissions` / `role_permissions`: Core RBAC definitions.
- `user_roles`: Maps users to specific roles at a given scope level (`global`, `department`, `unit`, `group`).
- `departments`: High-level organizational branches (e.g., Technical, Media, Operations).
- `units`: Tracks/sections belonging to departments (e.g., Flutter, Web, HR).
- `groups`: Student clusters inside units/tracks.
- `members` / `member_enrollments`: Links student users to their groups.
- `group_sessions` / `attendance`: Session scheduling and attendance marking.
- `assignments` / `assignment_submissions`: Task creation, student submissions, and grades.
- `applications`: Recruitment applications.
