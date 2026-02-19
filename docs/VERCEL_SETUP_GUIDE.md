# Vercel Setup Guide for Brand Me Now

Complete step-by-step guide to set up Vercel deployment. **Note: This project does NOT use GitHub integration with Vercel.**

## Prerequisites

- Node.js 18+ installed
- pnpm 8+ installed (`npm install -g pnpm@9.0.0`)
- Terminal access

---

## Setup Steps

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

Verify: `vercel --version`

---

### Step 2: Login to Vercel

**If you don't have a Vercel account:**
1. Go to [https://vercel.com/signup](https://vercel.com/signup)
2. Create account (skip GitHub repo connection)
3. Return to terminal

**Login:**
```bash
vercel login
```

Follow prompts to authenticate. Verify: `vercel whoami`

---

### Step 3: Navigate to Project and Link

```bash
cd E:\docs\BMN\brandmenow
vercel
```

Answer prompts:
- Set up and deploy? → **Y**
- Which scope? → **Select your account**
- Link to existing project? → **N** (create new)
- Project name? → **brandmenow**
- Code directory? → **./**

**If project is already linked but wrong:**
```bash
rmdir /s .vercel  # Windows
# OR
rm -rf .vercel    # Mac/Linux
```
Then run `vercel` again.

---

### Step 4: Configure Vercel Dashboard

1. Go to [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Click project **brandmenow**
3. Go to **Settings** → **Build and Deployment**

Configure these settings (enable override for each):

- **Framework Preset**: `Other` (Override: ON)
- **Build Command**: empty (Override: ON)
- **Output Directory**: `modules/membership/frontend/dist` (Override: ON)
- **Install Command**: empty (Override: ON)
- **Development Command**: empty (Override: OFF)

Click **Save**.

---

### Step 5: Deploy

**Local build:**
```bash
pnpm preview:local
```

**Production build:**
```bash
pnpm preview
```

Your project is now live! 🎉

