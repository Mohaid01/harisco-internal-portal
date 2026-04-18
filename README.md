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

## 🛠️ Environments & Configuration

The HarisCo portal supports two distinct environments. **SQLite** is used as the database for both environments to ensure simplicity and portability for an internal network tool.

### 1. Development Environment (Local Iteration)
Used when actively editing code. The frontend and backend run on separate ports with hot-reloading.

**Prerequisites:** Node.js (v18+)

```bash
# Terminal 1: Start Backend (Port 5000)
cd server
npm install
npx prisma db push
npm run seed        # Only run once to populate test accounts
npm run dev

# Terminal 2: Start Frontend (Port 5173)
cd client
npm install
npm run dev
```

### 2. Production Environment (Docker All-in-One)
Used when deploying the application to your local office server. The React frontend is compiled into static files and served directly by the Express backend, packaged inside a single, lightweight Docker container.

**Prerequisites:** Docker and Docker Compose

1. Move the entire project folder to your production server.
2. In the root directory (where `docker-compose.yml` is located), run:
```bash
docker-compose up -d --build
```
3. The portal is now live at `http://<YOUR_SERVER_IP>:5000`!

**Where is the production data stored?**
Docker Compose maps the internal SQLite database (`dev.db`) and automated backups to Docker Volumes on your host machine (`harisco_data` and `harisco_backups`). This ensures your data persists even if the container is restarted or updated.

---

## 🔑 Test Accounts (From DB Seed)

If you ran the `npm run seed` command, you can log in using the following test credentials:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Director** | `admin@harisco.com` | `admin123` |
| **IT Manager** | `it@harisco.com` | `it123` |
| **Admin** | `manager@harisco.com` | `manager123` |
| **Staff** | `staff@harisco.com` | `staff123` |

*(Note: Passwords are now securely hashed in the database using bcrypt!)*

