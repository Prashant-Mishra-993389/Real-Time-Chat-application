# SecureChat E2EE

A full-stack, end-to-end encrypted real-time messaging web application.

## Features
- **End-to-End Encryption (E2EE)**: Uses Web Crypto API (ECDH/AES-GCM via RSA-OAEP hybrid encryption) so the server never sees plaintext messages.
- **Real-Time Messaging**: Powered by Socket.IO for instant delivery.
- **User Discovery**: Search for users by username.
- **Secure Authentication**: JWT-based auth with bcrypt password hashing.
- **Persistent Storage**: MongoDB for users and encrypted messages; IndexedDB for secure local storage of private keys.

## Tech Stack
- **Frontend**: React, Tailwind CSS, Web Crypto API, Socket.IO Client
- **Backend**: Node.js, Express, Socket.IO, JWT, bcrypt
- **Database**: MongoDB (Mongoose)

## Deployment Instructions

### 1. Database (MongoDB Atlas)
1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) and create a free cluster.
2. Under "Database Access", create a user with read/write privileges.
3. Under "Network Access", allow access from anywhere (`0.0.0.0/0`).
4. Click "Connect" -> "Connect your application" and copy the connection string.
5. Replace `<password>` with your database user's password. This is your `MONGODB_URI`.

### 2. Backend (Render / Railway)
Since this is a full-stack app with Vite middleware, you can deploy the entire app as a single Node.js service.
1. Push this repository to GitHub.
2. Go to [Render](https://render.com/) or [Railway](https://railway.app/).
3. Create a new "Web Service" and connect your GitHub repository.
4. Set the Build Command to: `npm run build`
5. Set the Start Command to: `npm start`
6. Add the following Environment Variables:
   - `MONGODB_URI`: Your MongoDB connection string.
   - `JWT_SECRET`: A strong random string for signing JWTs.
   - `NODE_ENV`: `production`

### 3. Frontend (Vercel) - Optional Split Deployment
If you prefer to host the frontend separately on Vercel:
1. In `vite.config.ts`, remove the Express server integration or create a separate Vite config.
2. Push to GitHub and import the project in Vercel.
3. Set the Framework Preset to "Vite".
4. Add an environment variable `VITE_APP_URL` pointing to your deployed backend URL.
5. Deploy.

## Security Notes
- **Private Keys**: Stored securely in the browser's IndexedDB. If a user logs in from a new device, they will not be able to decrypt past messages unless key export/import functionality is added.
- **WebSockets**: In production, ensure your backend is served over HTTPS so WebSockets automatically use `wss://`.
