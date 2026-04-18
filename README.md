# HarisCo Internal Portal

A centralized internal portal designed for HarisCo to streamline office management. This application provides robust tools to manage employees, track hardware inventory, process multi-stage procurement requests, and handle IT repairs—all secured behind Role-Based Access Control (RBAC) and detailed audit logging.

## 🚀 Tech Stack

- **Frontend:** React, Vite, TailwindCSS, Lucide Icons
- **Backend:** Node.js, Express.js
- **Database:** SQLite with Prisma ORM
- **Authentication:** Role-Based Access Control (RBAC) enforced via Backend

## ✨ Key Features & Workflows

### 1. Role-Based Access Control (RBAC)
The portal automatically restricts access and UI elements based on the user's role:
- **DIRECTOR:** Full system access. Final approval authority for procurement and repairs. Can view all audit logs.
- **IT / ADMIN:** Can manage employees, view inventory, and approve early stages of requests. IT logs assets into inventory. Admins have restricted visibility into global audit logs.
- **STAFF:** Read-only access to their own dashboard. Cannot initiate procurement directly (must contact IT/Admin). Can submit repair requests for their assigned devices.

### 2. Multi-Stage Procurement & Repairs
A secure pipeline for purchasing new hardware or fixing existing assets:
- **Stage 1 (IT Review):** Validates technical requirements.
- **Stage 2 (Admin Approval):** Approves budget and operational need.
- **Stage 3 (Director Sign-off):** Final executive authorization.
- **Intake:** Once approved, assets are purchased and automatically logged into the central Inventory system.

### 3. Inventory Management
Track the complete lifecycle of office hardware (Laptops, Monitors, Mobile devices, etc.):
- **Statuses:** `IN_STOCK`, `ISSUED`, `REPAIR`
- Easily assign devices to specific employees and trace repair histories.

### 4. Global Audit Logging
Every mutation (create, update, approve, issue) is logged into an immutable Activity Log. High-level roles can view these logs and filter them by time (Last 15m, 1h, 4h, Today) to ensure complete transparency.

---

## 🛠️ Local Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/Mohaid01/harisco-internal-portal.git
cd harisco-internal-portal
```

### 2. Setup the Backend (Server)
Open a terminal and navigate to the `server` directory:
```bash
cd server

# Install dependencies
npm install

# Initialize the Prisma SQLite database and generate the client
npx prisma db push
npx prisma generate

# Seed the database with initial dummy data and test accounts
npm run seed

# Start the backend development server (Runs on port 5000)
npm run dev
```

### 3. Setup the Frontend (Client)
Open a **new** terminal and navigate to the `client` directory:
```bash
cd client

# Install dependencies
npm install

# Start the frontend development server (Runs on port 5173)
npm run dev
```

---

## 🔑 Test Accounts (From DB Seed)

If you ran the `npm run seed` command, you can log in using the following test credentials:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Director** | `admin@harisco.com` | `admin123` |
| **IT Manager** | `it@harisco.com` | `it123` |
| **Admin** | `manager@harisco.com` | `manager123` |
| **Staff** | `staff@harisco.com` | `staff123` |

*(Note: In the local dev environment, passwords are plain text or hardcoded fallbacks. Production deployment will utilize secure hashing or OAuth).*

## 🐳 Docker (Coming Soon)
A `docker-compose.yml` file is included in the root directory and is currently being configured for one-click local office deployments.
