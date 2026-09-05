# Gemini Me

A calm, personal journal that quietly becomes your personal assistant. Built with Google Cloud Run, Cloud Firestore, Firebase Authentication, and the Gemini API using the resilient **Mini-Me** reflection persona.

---

## 1. Overview & Architecture

Gemini Me allows you to write naturally about your day—plans, feelings, thoughts, and reflections—without needing to prompt or configure complex AI instructions. Mini-Me acts as a warm, plain-spoken, second-person companion that asks thoughtful follow-up questions on your first entry and provides distilled daily summaries.

### Architecture Highlights
- **User Identity**: Firebase Authentication (Google Sign-In exclusively, passwordless).
- **Isolated Cloud Storage**: Cloud Firestore with strict owner-isolated security rules (`users/{userId}/entries/{YYYY-MM-DD}`).
- **Backend AI Engine**: Express + Gemini API running server-side on Google Cloud Run.
- **Resilient AI Fallback Ladder**: Primary `gemini-3.6-flash` → `gemini-3.1-flash-lite` → `gemini-flash-latest` → `gemini-3.7-flash`.
- **Zero-Secret Client**: All API keys are resolved server-side via Google Cloud Secret Manager.

---

## 2. Prerequisites & Cloud Setup

Ensure you have the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) installed and authenticated:

```bash
# Authenticate with Google Cloud
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Enable the required Google Cloud APIs
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  cloudbuild.googleapis.com
```

---

## 3. Secret Management Setup (Zero Hardcoding)

Store the `GEMINI_API_KEY` securely in Google Cloud Secret Manager:

```bash
# 1. Create the secret in Secret Manager
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"

# 2. Add your Gemini API key as a secret version
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 3. Grant the Cloud Run compute service account access to read the secret
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)")

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 4. Firestore Database & Security Rules

1. Provision a Cloud Firestore database in Native mode via the Firebase Console or `gcloud`:
   ```bash
   gcloud firestore databases create --location=nam5 --type=firestore-native
   ```

2. Deploy the hardened, zero-insecure-default security rules in `firestore.rules`:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // Default deny all
       match /{document=**} {
         allow read, write: if false;
       }

       match /users/{userId} {
         allow read: if request.auth != null && request.auth.uid == userId;
         allow create: if request.auth != null && request.auth.uid == userId
                       && (!('role' in request.resource.data) || request.resource.data.role == 'user');
         allow update: if request.auth != null && request.auth.uid == userId
                       && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'createdAt']));

         match /entries/{entryId} {
           allow read, write: if request.auth != null && request.auth.uid == userId;
         }

         match /proposals/{proposalId} {
           allow read, write: if request.auth != null && request.auth.uid == userId;
         }

         match /interactions/{interactionId} {
           allow read, write: if request.auth != null && request.auth.uid == userId;
         }
       }
     }
   }
   ```

Deploy the rules using the Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 5. Deploying to Google Cloud Run

Deploy the full-stack container to Cloud Run, binding the secret directly into the runtime environment:

```bash
gcloud run deploy gemini-me \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
```

### Mandatory Verification Resource Labeling
To register the service for the automated Cloud Run developer challenge verification, apply the required campaign label:

```bash
gcloud run services update gemini-me \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 6. Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run type check
npm run lint

# Build full production bundle
npm run build
```
