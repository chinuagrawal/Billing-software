import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import commandHandler from './server/http/command';
import accountHandler from './server/http/account';
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    {
      name: 'billing-api-development',
      configureServer(server) {
        const env = loadEnv(mode, process.cwd(), '');
        for (const key of [
          'FIREBASE_PROJECT_ID',
          'FIREBASE_CLIENT_EMAIL',
          'FIREBASE_PRIVATE_KEY',
          'VITE_FIREBASE_PROJECT_ID',
        ]) {
          if (env[key] && !process.env[key]) process.env[key] = env[key];
        }
        server.middlewares.use('/api/command', (req, res) => {
          void commandHandler(req, res);
        });
        server.middlewares.use('/api/account', (req, res) => {
          void accountHandler(req, res);
        });
      },
    },
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: { firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'] },
      },
    },
  },
}));
