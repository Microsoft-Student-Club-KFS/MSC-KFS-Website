# Contributing to MSC-KFS

First of all, thank you for taking the time to contribute! 🎉 As an open-source project by and for the **Microsoft Campus Club at Kafrelsheikh University (MSC-KFS)**, this platform thrives on student contributions.

By contributing to this repository, you help improve the club's administration system while building real-world experience in software engineering, database management, and collaborative development.

---

## 1. Getting Started

### 1.1 Code of Conduct
Please read and respect our [Code of Conduct](CODE_OF_CONDUCT.md) in all your communications, issues, and pull requests.

### 1.2 Proposing Changes
*   **Search existing issues/PRs** first to ensure your idea or bug hasn't already been addressed.
*   If it's a new feature or bug, open an **Issue** to discuss it before working on a patch.

### 1.3 Setting Up Your Environment
Follow the installation instructions in the [README.md](README.md) to set up your local PostgreSQL database, Node.js API, and static frontend server.

---

## 2. Contribution Workflow

1.  **Fork the Repository:** Create a personal copy of the repository under your GitHub account.
2.  **Clone the Repository:**
    ```bash
    git clone https://github.com/YOUR-USERNAME/MSC-KFS.git
    cd MSC-KFS
    ```
3.  **Add Upstream Remote:**
    ```bash
    git remote add upstream https://github.com/Microsoft-Student-Club-KFS/MSC-KFS.git
    ```
4.  **Create a Branch:** Keep your branches focused and descriptive (e.g., `feature/student-grades` or `bugfix/auth-token-refresh`):
    ```bash
    git checkout -b feature/your-feature-name
    ```
5.  **Develop & Test:**
    *   Implement your changes.
    *   Test both backend and frontend locally to verify it works.
    *   Make sure there are no syntax or logic errors.
6.  **Commit Changes:** Keep commit messages clean, concise, and written in the imperative mood:
    ```bash
    git commit -am "feat: add task grading submission URL validation"
    ```
7.  **Sync with Upstream:** Fetch the latest changes from the main project and rebase or merge:
    ```bash
    git fetch upstream
    git checkout main
    git pull upstream main
    git checkout feature/your-feature-name
    git merge main
    ```
8.  **Push to GitHub:**
    ```bash
    git push origin feature/your-feature-name
    ```
9.  **Submit a Pull Request:** Go to the original repository on GitHub, click **New Pull Request**, choose your feature branch, and submit. Fill out the pull request template description clearly.

---

## 3. Style & Coding Guidelines

### 3.1 Backend (Node.js & Express)
*   **Clean Coding:** Follow standard JavaScript ES6 practices.
*   **Asynchronous Code:** Use `async/await` rather than raw promises where possible.
*   **Error Handling:** Always pass errors in middleware or routes to the Express central error handler (`next(err)`). Do not expose raw database errors to the user; use custom error messages or set `err.publicMessage`.
*   **API Design:** Build stateless, RESTful JSON endpoints.

### 3.2 Frontend (HTML/CSS/JS)
*   **Semantic HTML:** Use HTML5 tags (`<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`, etc.).
*   **Vanilla CSS:** Follow the established design system tokens in `frontend/css/styles.css` (use custom CSS variables like `var(--primary)` and `var(--surface)`). Do not write inline styles.
*   **Responsiveness:** All pages must look clean and work properly on both mobile devices and desktops.
*   **Clean JS:** Organize script controllers cleanly. Keep client logic decoupled from UI markup where possible.

### 3.3 Database (SQL)
*   If your feature requires schema changes, create a new SQL migration file in the root directory following the sequential format (e.g., `009_your_addition_name.sql`).
*   Keep SQL identifiers snake_case and lowercase. Write SQL keywords in UPPERCASE (e.g., `SELECT`, `INSERT`, `CREATE TABLE`).

---

## 4. Pull Request Requirements

Before your PR can be merged, it must meet the following criteria:
*   The code is functional and has been tested locally.
*   No sensitive API keys, secrets, or passwords are committed.
*   The code style matches the existing codebase.
*   Commit history is clean and does not contain temporary debugging commits (e.g. `console.log` cleanups).
*   A maintainer reviews and approves the PR.
