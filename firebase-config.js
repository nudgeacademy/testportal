// ==========================================
// Nudge Academy - Firebase Configuration
// ==========================================
// INSTRUCTIONS: Replace the values below with your Firebase project config
// Get this from: Firebase Console → Project Settings → Your apps → Web app

const firebaseConfig = {
    apiKey: "AIzaSyCTfD3827zN15diUTLR_j2UqaX4tItXXBY",
    authDomain: "nudge-test-portal.firebaseapp.com",
    projectId: "nudge-test-portal",
    storageBucket: "nudge-test-portal.firebasestorage.app",
    messagingSenderId: "568658283618",
    appId: "1:568658283618:web:7154c3c5afb220f3e8d53b"
};

// Demo mode detection - when config is not set, app runs in demo/localStorage mode
const isDemoMode = !firebaseConfig.apiKey ||
    firebaseConfig.apiKey === "YOUR_API_KEY" ||
    firebaseConfig.apiKey.length < 10;

// Initialize Firebase only if config is set
let db = null;
let auth = null;

if (!isDemoMode) {
    try {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        console.log("✅ Firebase initialized successfully");
    } catch (error) {
        console.error("❌ Firebase initialization error:", error);
    }
} else {
    console.log("⚠️ Running in DEMO MODE - data stored in localStorage only");
}

// Helper: Wait for Auth to initialize before making DB calls
const ensureAuthReady = () => {
    return new Promise((resolve) => {
        if (isDemoMode) return resolve(null);
        if (!auth) return resolve(null);

        const unsubscribe = auth.onAuthStateChanged(user => {
            unsubscribe();
            resolve(user);
        });
    });
};


// ==========================================
// Database Helper Functions
// ==========================================

const NudgeDB = {
    // ========== USER FUNCTIONS ==========

    async saveUser(user) {
        if (isDemoMode) {
            localStorage.setItem('nudge_user', JSON.stringify(user));
            return user;
        }

        await ensureAuthReady();

        let purchases = user.purchases || [];
        
        if (!isDemoMode && db) {
            try {
                const pendingSnapshot = await db.collection('preGrantedAccess').where('email', '==', user.email.toLowerCase().trim()).get();
                if (!pendingSnapshot.empty) {
                    const batch = db.batch();
                    pendingSnapshot.docs.forEach(doc => {
                        const data = doc.data();
                        const purchaseValue = data.folderName || data.folderId;
                        if (!purchases.includes(purchaseValue)) {
                            purchases.push(purchaseValue);
                        }
                        batch.delete(doc.ref);
                        
                        // Add to accessGrants for audit
                        batch.set(db.collection('accessGrants').doc(), {
                            userId: user.uid,
                            itemId: data.folderId,
                            itemName: data.folderName,
                            grantedBy: data.grantedBy || 'system_auto_grant',
                            grantedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    });
                    await batch.commit();
                    console.log('✅ Applied pre-granted access for', user.email);
                }
            } catch (e) {
                console.error("Error applying pre-granted access:", e);
            }
        }

        const userData = {
            uid: user.uid,
            name: user.name || user.displayName || user.email.split('@')[0],
            email: user.email,
            phone: user.phone || '',
            state: user.state || '',
            purchases: purchases,
            createdAt: user.createdAt || firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('users').doc(user.uid).set(userData, { merge: true });
        localStorage.setItem('nudge_user', JSON.stringify(userData));
        return userData;
    },

    // Get user profile from Firestore
    async getUser(uid) {
        if (isDemoMode) {
            return JSON.parse(localStorage.getItem('nudge_user'));
        }

        await ensureAuthReady();
        try {
            const doc = await db.collection('users').doc(uid).get();
            if (doc.exists) {
                const userData = doc.data();
                localStorage.setItem('nudge_user', JSON.stringify(userData));
                return userData;
            }
        } catch (error) {
            console.error('Error getting user:', error);
        }
        return null;
    },

    // Add purchase to user
    async addPurchase(uid, itemId) {
        if (isDemoMode) {
            const purchases = JSON.parse(localStorage.getItem('nudge_user_purchases') || '[]');
            if (!purchases.includes(itemId)) {
                purchases.push(itemId);
                localStorage.setItem('nudge_user_purchases', JSON.stringify(purchases));
            }
            return purchases;
        }

        await ensureAuthReady();
        await db.collection('users').doc(uid).set({
            purchases: firebase.firestore.FieldValue.arrayUnion(itemId),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Update local cache
        const user = await this.getUser(uid);
        return user.purchases;
    },

    // Get user purchases
    async getPurchases(uid) {
        if (isDemoMode) {
            return JSON.parse(localStorage.getItem('nudge_user_purchases') || '[]');
        }

        const user = await this.getUser(uid);
        return user?.purchases || [];
    },

    // ========== PAYMENT FUNCTIONS ==========

    // Save payment record
    async savePayment(paymentRecord) {
        if (isDemoMode) {
            const payments = JSON.parse(localStorage.getItem('nudge_payments') || '[]');
            payments.push(paymentRecord);
            localStorage.setItem('nudge_payments', JSON.stringify(payments));
            return paymentRecord;
        }

        await ensureAuthReady();
        const paymentData = {
            ...paymentRecord,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        let docId = 'pay_' + Date.now();
        let mainWriteSuccess = false;

        // 1. Try saving to main payments collection (might fail due to permissions)
        try {
            const docRef = await db.collection('payments').add(paymentData);
            docId = docRef.id;
            mainWriteSuccess = true;
        } catch (e) {
            console.warn('⚠️ non-fatal: Failed to write to main payments collection (permission/missing):', e.message);
        }

        // 2. Also save to user's payments subcollection (usually allowed)
        try {
            await db.collection('users').doc(paymentRecord.userId).collection('payments').doc(docId).set(paymentData);
        } catch (e) {
            console.error('❌ Failed to write to user payments subcollection:', e.message);
            // Only fail if BOTH writes failed
            if (!mainWriteSuccess) throw e;
        }

        return { id: docId, ...paymentData };
    },

    // Get user's payment history
    async getUserPayments(uid) {
        if (isDemoMode) {
            const payments = JSON.parse(localStorage.getItem('nudge_payments') || '[]');
            return payments.filter(p => p.userId === uid);
        }

        await ensureAuthReady();
        const snapshot = await db.collection('users').doc(uid).collection('payments')
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    // ========== RESULTS FUNCTIONS ==========

    // Save test result (keeps only 5 most recent per user)
    async saveResult(result) {
        const MAX_RESULTS = 5;

        if (isDemoMode) {
            let results = JSON.parse(localStorage.getItem('nudge_results') || '[]');
            result.id = 'result_' + Date.now();
            results.push(result);

            // Keep only 5 most recent for this user
            const userResults = results.filter(r => r.userId === result.userId);
            if (userResults.length > MAX_RESULTS) {
                // Sort by date (oldest first) and remove excess
                const sortedUserResults = userResults.sort((a, b) => new Date(a.date) - new Date(b.date));
                const toDelete = sortedUserResults.slice(0, userResults.length - MAX_RESULTS);
                results = results.filter(r => !toDelete.some(d => d.id === r.id));
            }

            localStorage.setItem('nudge_results', JSON.stringify(results));
            return result;
        }

        await ensureAuthReady();
        const resultData = {
            ...result,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        const docRef = await db.collection('results').add(resultData);
        resultData.id = docRef.id;

        // Also save to user's subcollection for easier querying
        if (result.userId) {
            await db.collection('users').doc(result.userId).collection('results').doc(docRef.id).set(resultData);

            // Cleanup: Keep only 5 most recent results for this user
            try {
                const userResultsSnapshot = await db.collection('users').doc(result.userId).collection('results')
                    .orderBy('createdAt', 'desc')
                    .get();

                if (userResultsSnapshot.docs.length > MAX_RESULTS) {
                    // Get results to delete (all except the 5 most recent)
                    const toDelete = userResultsSnapshot.docs.slice(MAX_RESULTS);

                    // Delete from user's subcollection and main results collection
                    const batch = db.batch();
                    toDelete.forEach(doc => {
                        batch.delete(doc.ref);
                        // Also delete from main results collection
                        batch.delete(db.collection('results').doc(doc.id));
                    });
                    await batch.commit();
                    console.log(`Cleaned up ${toDelete.length} old results for user ${result.userId}`);
                }
            } catch (cleanupError) {
                console.error('Error during results cleanup:', cleanupError);
                // Don't fail the main operation if cleanup fails
            }
        }

        return resultData;
    },

    // Get user's results (max 5 most recent)
    async getUserResults(uid) {
        if (isDemoMode) {
            const results = JSON.parse(localStorage.getItem('nudge_results') || '[]');
            return results
                .filter(r => r.userId === uid)
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 5);
        }

        await ensureAuthReady();
        const snapshot = await db.collection('users').doc(uid).collection('results')
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    // Get all results (for leaderboard)
    async getAllResults(limit = 100) {
        if (isDemoMode) {
            return JSON.parse(localStorage.getItem('nudge_results') || '[]');
        }

        await ensureAuthReady();
        const snapshot = await db.collection('results')
            .orderBy('percentage', 'desc')
            .limit(limit)
            .get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    // ========== ADMIN FUNCTIONS ==========

    // Setup initial admin (run once via init-db.html or manually)
    async setupAdmin(email, name) {
        if (isDemoMode) {
            console.log('Demo mode: Admin setup simulated');
            return { email, name, role: 'admin' };
        }

        const user = firebase.auth().currentUser;
        if (!user) {
            throw new Error('Must be logged in to setup admin');
        }

        await db.collection('admins').doc(user.uid).set({
            email: email,
            name: name,
            role: 'admin',
            uid: user.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        return { email, name, role: 'admin', uid: user.uid };
    },

    // Verify admin credentials
    async verifyAdmin(email, password) {
        console.log('🔐 verifyAdmin START for:', email);
        console.log('🔧 isDemoMode:', isDemoMode);

        if (isDemoMode) {
            console.log('⚠️ Running in DEMO MODE');
            // Demo admin credentials
            const validAdmins = [
                { email: 'admin@nudge.com', password: 'admin123', name: 'Nudge Admin' },
                { email: 'ceo@nudgeacademy.com', password: 'asif', name: 'Nudge CEO' }
            ];
            const admin = validAdmins.find(a => a.email === email && a.password === password);
            return admin ? { ...admin, role: 'admin' } : null;
        }

        try {
            // 1. Sign in with Firebase Auth
            console.log('📡 Step 1: Calling Firebase Auth signInWithEmailAndPassword...');
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            console.log('✅ Step 1 SUCCESS: Firebase Auth signed in');
            console.log('   └─ User UID:', user.uid);
            console.log('   └─ User Email:', user.email);

            // 2. Check if user exists in admins collection (by UID first, then email)
            let adminData = null;

            // Try by UID first
            console.log('📡 Step 2a: Checking admins collection by UID:', user.uid);
            try {
                const uidDoc = await db.collection('admins').doc(user.uid).get();
                console.log('   └─ uidDoc.exists:', uidDoc.exists);
                if (uidDoc.exists) {
                    adminData = uidDoc.data();
                    console.log('✅ Step 2a SUCCESS: Found admin doc by UID');
                    console.log('   └─ Admin data:', JSON.stringify(adminData));
                } else {
                    console.log('⚠️ Step 2a: No doc found by UID, will try email query');
                }
            } catch (uidErr) {
                console.error('❌ Step 2a ERROR checking by UID:', uidErr);
                console.error('   └─ This might be a Firestore permissions issue!');
            }

            if (!adminData) {
                // Fallback: check by email
                console.log('📡 Step 2b: Checking admins collection by email:', email);
                try {
                    const snapshot = await db.collection('admins').where('email', '==', email).get();
                    console.log('   └─ Query returned', snapshot.size, 'documents');
                    if (!snapshot.empty) {
                        adminData = snapshot.docs[0].data();
                        console.log('✅ Step 2b SUCCESS: Found admin doc by email');
                        console.log('   └─ Doc ID:', snapshot.docs[0].id);
                        console.log('   └─ Admin data:', JSON.stringify(adminData));
                    } else {
                        console.log('⚠️ Step 2b: No docs found matching email');
                    }
                } catch (emailErr) {
                    console.error('❌ Step 2b ERROR checking by email:', emailErr);
                    console.error('   └─ Error code:', emailErr.code);
                    console.error('   └─ This might be a Firestore permissions issue!');
                }
            }

            if (adminData) {
                console.log('✅ Step 3: Admin found, returning admin object');
                return {
                    ...adminData,
                    uid: user.uid,
                    email: user.email,  // Always include email from Auth
                    name: adminData.name || user.email.split('@')[0],
                    role: 'admin'
                };
            } else {
                // User exists in Auth but not an admin
                console.warn('⚠️ Step 3: Login successful but user is NOT in admins collection.');
                console.warn('   └─ The user authenticated but no matching admin document was found.');
                console.warn('   └─ Expected: admins/{' + user.uid + '} OR admins where email == "' + email + '"');
                await auth.signOut();
                return null;
            }
        } catch (error) {
            console.error("❌ Admin login error:", error);
            console.error("   └─ Error code:", error.code);
            console.error("   └─ Error message:", error.message);
            throw error;
        }
    },

    // Verify mentor credentials
    async verifyMentor(email, password) {
        if (isDemoMode) {
            const validMentors = [
                { email: 'nada@nudge.academy', password: 'nudgeacademy', name: 'Nudge Mentor' }
            ];
            const mentor = validMentors.find(a => a.email === email && a.password === password);
            return mentor ? { ...mentor, role: 'mentor' } : null;
        }

        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            let mentorData = null;

            try {
                const uidDoc = await db.collection('mentors').doc(user.uid).get();
                if (uidDoc.exists) {
                    mentorData = uidDoc.data();
                }
            } catch (err) { }

            if (!mentorData) {
                try {
                    const snapshot = await db.collection('mentors').where('email', '==', email).get();
                    if (!snapshot.empty) {
                        mentorData = snapshot.docs[0].data();
                    }
                } catch (err) { }
            }

            // Fallback for explicitly requested mentor email
            if (!mentorData && email === 'nada@nudge.academy') {
                mentorData = { email: email, name: 'Nudge Mentor' };
            }

            if (mentorData) {
                return {
                    ...mentorData,
                    uid: user.uid,
                    email: user.email,
                    name: mentorData.name || user.email.split('@')[0],
                    role: 'mentor'
                };
            } else {
                await auth.signOut();
                return null;
            }
        } catch (error) {
            throw error;
        }
    },

    // Logout user
    async logout() {
        try {
            if (!isDemoMode && auth) {
                await auth.signOut();
            }
            localStorage.removeItem('nudge_user');
            localStorage.removeItem('nudge_admin');
            localStorage.removeItem('nudge_user_purchases');
            localStorage.removeItem('nudge_current_test');
            return true;
        } catch (error) {
            console.error('Logout error:', error);
            return false;
        }
    },

    // ========== TESTS FUNCTIONS ==========

    // Get all tests (from Firestore or fallback to localStorage)
    async getTests(includeInactive = false) {
        console.log('📡 NudgeDB.getTests() called, isDemoMode:', isDemoMode);

        if (isDemoMode) {
            const tests = JSON.parse(localStorage.getItem('nudge_tests') || '[]');
            console.log('📦 Demo mode: returning', tests.length, 'tests from localStorage');
            return tests;
        }

        try {
            await ensureAuthReady();
            console.log('📡 Firestore: fetching all tests (no status filter)...');

            // TEMPORARY: Fetch ALL tests without filtering
            // TODO: Restore status filter after debugging
            const snapshot = await db.collection('tests').get();

            console.log('📄 Firestore snapshot:', snapshot.empty ? 'EMPTY' : snapshot.size + ' docs');

            if (snapshot.empty) {
                console.log('⚠️ No tests found in Firestore!');
                return [];
            }

            const tests = snapshot.docs.map(doc => {
                const data = doc.data();
                console.log('📄 Test doc:', doc.id, '| status:', data.status, '| title:', data.title);
                return { id: doc.id, ...data };
            });

            console.log('✅ Returning', tests.length, 'tests from Firestore');

            // Sort by custom order
            return tests.sort((a, b) => {
                const orderA = a.order !== undefined ? a.order : 999999;
                const orderB = b.order !== undefined ? b.order : 999999;

                // If orders are equal (or both undefined), fall back to createdAt desc (newest first)
                if (orderA === orderB) {
                    // Handle Firestore timestamps or ISO strings
                    const dateA = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                    const dateB = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                    return dateB - dateA;
                }
                return orderA - orderB;
            });
        } catch (e) {
            console.error('❌ Error fetching tests:', e);
            console.error('   └─ Error code:', e.code);
            console.error('   └─ Error message:', e.message);
            return [];
        }
    },

    // Save a test (admin function)
    async saveTest(test) {
        if (isDemoMode) {
            const tests = JSON.parse(localStorage.getItem('nudge_tests') || '[]');
            if (test.id) {
                const index = tests.findIndex(t => t.id === test.id);
                if (index > -1) tests[index] = test;
                else tests.push(test);
            } else {
                test.id = 'test_' + Date.now();
                tests.push(test);
            }
            localStorage.setItem('nudge_tests', JSON.stringify(tests));
            return test;
        }

        await ensureAuthReady();

        const testData = {
            ...test,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (test.id) {
            await db.collection('tests').doc(test.id).set(testData, { merge: true });
        } else {
            testData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const docRef = await db.collection('tests').add(testData);
            test.id = docRef.id;
        }
        return test;
    },

    // Delete a test
    async deleteTest(testId) {
        if (isDemoMode) {
            const tests = JSON.parse(localStorage.getItem('nudge_tests') || '[]');
            const filtered = tests.filter(t => t.id !== testId);
            localStorage.setItem('nudge_tests', JSON.stringify(filtered));
            return true;
        }

        await ensureAuthReady();
        await db.collection('tests').doc(testId).delete();
        return true;
    },

    // ========== FOLDERS FUNCTIONS ==========

    // Get all folders
    async getFolders() {
        console.log('📡 NudgeDB.getFolders() called, isDemoMode:', isDemoMode);

        if (isDemoMode) {
            const folders = JSON.parse(localStorage.getItem('nudge_custom_folders') || '[]');
            console.log('📦 Demo mode: returning', folders.length, 'folders from localStorage');
            return folders;
        }

        try {
            await ensureAuthReady();
            console.log('📡 Firestore: fetching all folders...');
            const snapshot = await db.collection('folders').get();

            console.log('📄 Folders snapshot:', snapshot.empty ? 'EMPTY' : snapshot.size + ' docs');

            const folders = snapshot.docs.map(doc => {
                const data = doc.data();
                console.log('📄 Folder doc:', doc.id, '| name:', data.name);
                return { id: doc.id, ...data };
            });

            console.log('✅ Returning', folders.length, 'folders from Firestore');
            return folders;
        } catch (e) {
            console.error('❌ Error fetching folders:', e);
            console.error('   └─ Error code:', e.code);
            console.error('   └─ Error message:', e.message);
            return [];
        }
    },

    // Save a folder
    // Save a folder (Create or Update)
    async saveFolder(folder) {
        if (isDemoMode) {
            let folders = JSON.parse(localStorage.getItem('nudge_custom_folders') || '[]');
            if (folder.id) {
                // Update existing
                const index = folders.findIndex(f => f.id === folder.id);
                if (index > -1) {
                    folders[index] = { ...folders[index], ...folder };
                } else {
                    folders.push(folder);
                }
            } else {
                // Create new
                folder.id = 'folder_' + Date.now();
                folders.push(folder);
            }
            localStorage.setItem('nudge_custom_folders', JSON.stringify(folders));
            return folder;
        }

        await ensureAuthReady();

        const folderData = { ...folder };

        if (folder.id) {
            // Update existing
            folderData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('folders').doc(folder.id).set(folderData, { merge: true });
            return folderData;
        } else {
            // Create new
            folderData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const docRef = await db.collection('folders').add(folderData);
            return { ...folderData, id: docRef.id };
        }
    },

    // Delete a folder
    async deleteFolder(folderId) {
        if (isDemoMode) {
            let folders = JSON.parse(localStorage.getItem('nudge_custom_folders') || '[]');
            folders = folders.filter(f => f.id !== folderId);
            localStorage.setItem('nudge_custom_folders', JSON.stringify(folders));
            return true;
        }

        await ensureAuthReady();
        await db.collection('folders').doc(folderId).delete();
        return true;
    },

    // ========== ADMIN: USER MANAGEMENT FUNCTIONS ==========

    // Get all registered users (admin only)
    async getAllUsers() {
        if (isDemoMode) {
            console.log('📦 Demo mode: returning mock users');
            return [
                { uid: 'demo_user_1', name: 'Demo Student', email: 'student@demo.com', purchases: [], phone: '9999999999' }
            ];
        }

        try {
            await ensureAuthReady();
            console.log('📡 Firestore: fetching all users...');
            const snapshot = await db.collection('users').get();

            if (snapshot.empty) {
                console.log('⚠️ No users found in Firestore');
                return [];
            }

            const users = snapshot.docs.map(doc => {
                const data = doc.data();
                return { uid: doc.id, ...data };
            });

            console.log('✅ Returning', users.length, 'users from Firestore');
            return users;
        } catch (e) {
            console.error('❌ Error fetching users:', e);
            return [];
        }
    },

    // Grant access to a user (admin function - adds item to user's purchases)
    async grantAccess(uid, itemId, itemName = '') {
        console.log('🔓 Granting access:', uid, 'for item:', itemId, 'name:', itemName);

        if (isDemoMode) {
            console.log('📦 Demo mode: simulating access grant');
            return { success: true, message: 'Demo mode - access granted' };
        }

        try {
            await ensureAuthReady();

            // Use folder name for purchases (this is what the student dashboard checks)
            // Only add one entry to avoid double-counting
            const purchaseValue = itemName || itemId;

            await db.collection('users').doc(uid).set({
                purchases: firebase.firestore.FieldValue.arrayUnion(purchaseValue),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            // Log the grant for audit purposes
            await db.collection('accessGrants').add({
                userId: uid,
                itemId: itemId,
                itemName: itemName,
                grantedBy: window.ADMIN_USER?.email || 'admin',
                grantedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log('✅ Access granted successfully');
            return { success: true, message: 'Access granted successfully' };
        } catch (e) {
            console.error('❌ Error granting access:', e);
            return { success: false, message: e.message };
        }
    },

    // Grant access by email (handles both existing and un-registered users)
    async grantAccessByEmail(email, itemId, itemName = '') {
        console.log('🔓 Granting access by email:', email, 'for item:', itemId, 'name:', itemName);

        if (isDemoMode) {
            console.log('📦 Demo mode: simulating access grant by email');
            return { success: true, message: 'Demo mode - access granted' };
        }

        try {
            await ensureAuthReady();
            const emailLower = email.toLowerCase().trim();

            // First check if user exists
            const snapshot = await db.collection('users').where('email', '==', emailLower).get();
            if (!snapshot.empty) {
                const uid = snapshot.docs[0].id;
                console.log('User found, calling regular grantAccess');
                return await this.grantAccess(uid, itemId, itemName);
            }

            // User does not exist, save to preGrantedAccess
            await db.collection('preGrantedAccess').add({
                email: emailLower,
                folderId: itemId,
                folderName: itemName,
                grantedBy: window.ADMIN_USER?.email || 'admin',
                grantedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log('✅ Access pre-granted to unregistered email');
            return { success: true, message: 'Access pre-granted successfully. They will receive it upon registration.' };
        } catch (e) {
            console.error('❌ Error granting access by email:', e);
            return { success: false, message: e.message };
        }
    },

    // Create a new student account (admin function)
    async createStudent({ name, email, password, phone }) {
        if (isDemoMode) {
            console.log('📦 Demo mode: simulating student creation', { name, email, phone });
            return { success: true, message: 'Demo mode - student created successfully' };
        }

        try {
            await ensureAuthReady();

            // Check if user is admin
            if (!window.ADMIN_USER) {
                return { success: false, message: 'Unauthorized: Admin access required' };
            }

            console.log('🧑‍🎓 Creating new student:', email);

            // Create a secondary Firebase app instance to handle the auth creation
            // This prevents the current admin user from being signed out
            const appName = 'SecondaryApp_' + Date.now();
            const secondaryApp = firebase.initializeApp(firebaseConfig, appName);

            try {
                // Create the user in Auth
                const userCredential = await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
                const uid = userCredential.user.uid;

                // Save the user profile to Firestore using the MAIN app instance
                const userData = {
                    uid: uid,
                    name: name,
                    email: email,
                    phone: phone || '',
                    role: 'student',
                    purchases: [],
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                await db.collection('users').doc(uid).set(userData);

                console.log('✅ Student created successfully with UID:', uid);

                // Sign out of the secondary app and delete the instance
                await secondaryApp.auth().signOut();
                await secondaryApp.delete();

                return { success: true, message: 'Student created successfully', uid: uid };
            } catch (authError) {
                // Make sure we clean up the secondary app even if creation fails
                await secondaryApp.delete();
                console.error('❌ Auth error creating student:', authError);
                return { success: false, message: authError.message };
            }
        } catch (e) {
            console.error('❌ General error creating student:', e);
            return { success: false, message: e.message };
        }
    }
};

// Export for use in other files
window.NudgeDB = NudgeDB;
window.isDemoMode = isDemoMode;
window.firebaseAuth = auth;
window.firebaseDB = db;
