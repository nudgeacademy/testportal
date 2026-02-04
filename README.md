# Nudge Academy - CUET Mock Test Platform (Fixed Version)

A modern, responsive mock test platform for CUET (Common University Entrance Test) preparation built with vanilla HTML, CSS, and JavaScript.

## 🔧 Changes Made (Fixed Version)

### Critical Fixes Applied:
1. ✅ **Added `isDemoPayment` declaration** - Fixed undefined variable error in index.html
2. ✅ **Removed Cloudflare script** - Incompatible with Vercel hosting
3. ✅ **Removed hardcoded default tests** - All tests now loaded from Firestore only
4. ✅ **Improved firebase-config.js** - Better error handling and logout function
5. ✅ **Updated exam.html** - Proper error handling when test has no questions
6. ✅ **Improved admin.html** - Now loads ALL tests including inactive ones
7. ✅ **Added Vercel configuration** - vercel.json for proper deployment
8. ✅ **Added Firestore security rules** - Production-ready security
9. ✅ **Improved init-db.html** - Better database initialization UI

## 📁 Project Structure

```
nudge-academy-fixed/
├── index.html           # Student login page
├── index.html       # Student dashboard with tests
├── exam.html           # Test taking interface
├── result.html         # Results and analysis
├── admin_login.html    # Admin login
├── admin.html          # Admin panel (create/manage tests)
├── init-db.html        # Database initialization tool
├── 404.html            # Error page
├── firebase-config.js  # Firebase & database helpers
├── firestore.rules     # Security rules (copy to Firebase Console)
├── vercel.json         # Vercel deployment config
└── NUDGE_LOGO.png      # Logo asset
```

## 🚀 Quick Setup for Vercel + Firebase

### Step 1: Firebase Setup
1. Create project at [Firebase Console](https://console.firebase.google.com)
2. Enable Authentication → Email/Password + Google
3. Create Firestore Database
4. Add your Vercel domain to Authorized Domains:
   - Firebase Console → Authentication → Settings → Authorized Domains
   - Add: `your-project.vercel.app`

### Step 2: Update Security Rules
1. Go to Firebase Console → Firestore → Rules
2. Copy contents of `firestore.rules` file
3. Click Publish

### Step 3: Deploy to Vercel
1. Push code to GitHub
2. Import in Vercel
3. Deploy!

### Step 4: Initialize Database
1. Open `https://your-site.vercel.app/init-db.html`
2. Create admin user
3. Initialize database collections

### Step 5: Create Content
1. Go to `admin_login.html`
2. Login with admin credentials
3. Create folders (test bundles)
4. Create tests with questions

## 💡 Key Features

- **100% Firestore-based** - All tests and folders stored in Firebase
- **No hardcoded data** - Everything managed via admin panel
- **Guest access** - Users can browse tests without login
- **Razorpay integration** - Secure payments for premium content
- **Admin panel** - Full test creation with DOCX/TSX import
- **Real-time sync** - Data synced across all devices

## 🔐 Security Notes

- API keys in `firebase-config.js` are client-side (protected by security rules)
- Razorpay live key is expected to be client-side
- For production, consider server-side order creation
- Never commit sensitive secrets to version control

## 📱 Test Credentials (Demo Mode)

**Student:**
- Any email/password (will create account in demo mode)

**Admin:**
- Email: `admin@nudge.com`
- Password: `admin123`

## 💳 Test Payments (Razorpay Test Mode)

Use these in test mode:
- Card: `4111 1111 1111 1111`
- Expiry: Any future date
- CVV: Any 3 digits
- OTP: `1234`

---

Made with ❤️ by Nudge Academy Team
