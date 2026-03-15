# SEEP - Smart Examination Environment Platform

A secure, modern, and robust examination platform built with React, TypeScript, and Supabase.

## 🚀 Features

- **Secure Examination Environment**:
  - Mandatory Fullscreen mode with a 10-second auto-submit penalty for exiting.
  - Server-side grading via PostgreSQL RPC to prevent frontend tampering.
  - Sensitive data (correct answers, test cases) isolated in admin-only tables.
- **Advanced Admin Dashboard**:
  - Full CRUD for Exams (MCQ & DSA Coding questions).
  - User Management (Role promotion/demotion).
  - CSV Exports for Results and User lists.
  - Real-time Analytics and Pass-Rate tracking.
- **User Experience**:
  - Live progress tracking and server-synced timers.
  - Attempt limits per exam.
  - Performance trend visualization.
- **Security & Integrity**:
  - Robust Row Level Security (RLS) policies.
  - Automatic profile creation on signup via database triggers.

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS.
- **UI Components**: shadcn/ui, Framer Motion, Lucide Icons.
- **Backend/Database**: Supabase (PostgreSQL, Auth, RLS).
- **State Management**: React Context, TanStack Query.

## 🏁 Getting Started

### Prerequisites
- Node.js (v18+)
- npm or bun

### Installation
1. **Clone the repository**
   ```sh
   git clone <your-repo-url>
   cd see-smart-exam-main
   ```

2. **Install dependencies**
   ```sh
   npm install
   ```

3. **Environment Variables**
   Create a `.env` file in the root and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Run the application**
   ```sh
   npm run dev
   ```

## 🗄️ Database Setup

To set up the database, follow these steps in your **Supabase SQL Editor**:

1. Run the entire content of `supabase_schema.sql` to create the tables, triggers, and the secure grading function.
2. Ensure you have an administrator. You can promote any user to admin by running:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
   ```

## 📁 Repository Cleanup

The following temporary files were used during the security migration and have been consolidated into `supabase_schema.sql` and this `README.md`:
- `UPDATE_RLS_POLICIES.md`
- `FIX_USER_RESULTS_COLUMNS.md`
- `FIX_EXAMS_MAX_ATTEMPTS.md`

## 📄 License
This project is for educational and professional examination purposes.
# SEEP
# SEEP
