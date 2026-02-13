# Nudge Academy - Vercel Deployment Guide

## 📋 Pre-Deployment Checklist

Before deploying, ensure you have:
- [ ] Firebase project created
- [ ] Firebase Authentication enabled (Email/Password + Google)
- [ ] Firestore Database created
- [ ] Razorpay account (for payments)

---

## Step 1: Firebase Console Setup

### 1.1 Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project"
3. Name it: `nudge-academy`
4. Disable Google Analytics (optional)
5. Click "Create Project"

### 1.2 Enable Authentication
1. Go to Build → Authentication
2. Click "Get started"
3. Enable **Email/Password**
4. Enable **Google** (add support email)

### 1.3 Create Firestore Database
1. Go to Build → Firestore Database
2. Click "Create database"
3. Choose **Production mode**
4. Select location: `asia-south1` (Mumbai)
5. Click Enable

### 1.4 Get Firebase Config
1. Click ⚙️ Project Settings
2. Scroll to "Your apps"
3. Click Web icon `</>`
4. Register app: `nudge-web`
5. Copy the `firebaseConfig` object

### 1.5 Update Security Rules
1. Go to Firestore → Rules
2. Replace with contents of `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    
    function isAdmin() {
      return isAuthenticated() && 
        exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }
    
    match /users/{userId} {
      allow read, write: if isOwner(userId);
      allow read: if isAdmin();
      
      match /results/{resultId} {
        allow read, write: if isOwner(userId);
        allow read: if isAdmin();
      }
      
      match /payments/{paymentId} {
        allow read: if isOwner(userId);
        allow create: if isOwner(userId);
        allow read: if isAdmin();
      }
    }
    
    match /tests/{testId} {
      allow read: if resource.data.status == 'active';
      allow read: if isAdmin();
      allow create, update, delete: if isAdmin();
    }
    
    match /folders/{folderId} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }
    
    match /results/{resultId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && 
        request.resource.data.userId == request.auth.uid;
      allow update, delete: if false;
    }
    
    match /payments/{paymentId} {
      allow create: if isAuthenticated() && 
        request.resource.data.userId == request.auth.uid;
      allow read: if isAuthenticated() && 
        resource.data.userId == request.auth.uid;
      allow read: if isAdmin();
      allow update, delete: if false;
    }
    
    match /admins/{adminId} {
      allow read: if isAuthenticated();
      allow write: if false;
    }
  }
}
```

3. Click "Publish"

---

## Step 2: Update Your Code

### 2.1 Update firebase-config.js
Replace the config with your Firebase project details:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
};
```

### 2.2 Update Razorpay Key (index.html)
Find this line (~line 1873):
```javascript
const RAZORPAY_KEY_ID = 'rzp_live_SBEF07iMYwu5dh';
```

Replace with your key:
```javascript
const RAZORPAY_KEY_ID = 'rzp_test_xxxxx'; // Use test key first!
```

---

## Step 3: Deploy to Vercel

### 3.1 Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit - Nudge Academy"
git remote add origin https://github.com/YOUR_USERNAME/nudge-academy.git
git push -u origin main
```

### 3.2 Import to Vercel
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Framework Preset: **Other**
5. Root Directory: `.` (leave as is)
6. Click "Deploy"

### 3.3 Get Your Domain
After deployment, you'll get a URL like:
`https://nudge-academy-xxxxx.vercel.app`

---

## Step 4: Add Authorized Domain in Firebase

**IMPORTANT:** This step is required for authentication to work!

1. Go to Firebase Console → Authentication → Settings
2. Scroll to "Authorized domains"
3. Click "Add domain"
4. Add your Vercel domain: `nudge-academy-xxxxx.vercel.app`
5. Also add: `*.vercel.app` (for preview deployments)

---

## Step 5: Initialize Database

### 5.1 Open Init Page
Go to: `https://your-domain.vercel.app/init-db.html`

### 5.2 Create Admin User
1. Enter admin email (e.g., `admin@nudge.com`)
2. Enter password (change later!)
3. Enter admin name
4. Click "Create Admin User"

### 5.3 Initialize Collections
1. Click "Initialize Database"
2. Wait for completion
3. You should see green checkmarks

---

## Step 6: Create Content

### 6.1 Login to Admin Panel
1. Go to: `https://your-domain.vercel.app/admin_login.html`
2. Login with admin credentials

### 6.2 Create Folders (Test Bundles)
1. Go to "Folders" in sidebar
2. Enter folder name (e.g., "CUET Economics")
3. Set price (0 for free)
4. Choose icon
5. Click "Create Folder"

### 6.3 Create Tests
1. Click "Create New Test"
2. Upload questions (DOCX/TSX format)
3. Configure test settings
4. Select folder (subject)
5. Publish!

---

## 🔄 Test Your Setup

### As Student:
1. Visit your site
2. Browse available tests
3. Register/Login
4. Take a free test
5. View results

### As Admin:
1. Login to admin panel
2. Create a folder
3. Create a test with questions
4. Verify it appears on dashboard

---

## 🚨 Troubleshooting

### "auth/unauthorized-domain" Error
- Add your domain to Firebase → Authentication → Authorized domains

### Tests Not Loading
- Check browser console for errors
- Verify Firestore security rules are published
- Ensure tests have `status: 'active'`

### Payment Not Working
- Ensure Razorpay key is correct
- Check if using test mode (use `rzp_test_` key)
- Verify user is logged in

### Admin Can't Login
- Run init-db.html to create admin user
- Check that user exists in Firebase Auth
- Verify admin document in `admins` collection

---

## 📞 Quick Links

- [Firebase Console](https://console.firebase.google.com)
- [Vercel Dashboard](https://vercel.com/dashboard)
- [Razorpay Dashboard](https://dashboard.razorpay.com)

---

Good luck with your CUET prep platform! 🎓
