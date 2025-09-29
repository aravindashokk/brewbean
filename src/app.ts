import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB } from './config/database.js';
import { WorkOS } from '@workos-inc/node';
import cookieParser from 'cookie-parser';
import cors from 'cors';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  })
);

app.use(morgan('dev'));
app.use(cookieParser());

if (!process.env.WORKOS_API_KEY || !process.env.WORKOS_CLIENT_ID || !process.env.WORKOS_COOKIE_PASSWORD) {
  console.error('Missing required environment variables!');
  process.exit(1);
}

const workos = new WorkOS(process.env.WORKOS_API_KEY, {
  clientId: process.env.WORKOS_CLIENT_ID,
});

// ---------------------------
// Auth middleware
// ---------------------------
async function withAuth(req: Request, res: Response, next: NextFunction) {
  const sessionCookie = req.cookies['wos-session'];
  if (!sessionCookie) return res.redirect('http://localhost:5173/login');

  try {
    const session = workos.userManagement.loadSealedSession({
      sessionData: sessionCookie,
      cookiePassword: process.env.WORKOS_COOKIE_PASSWORD!,
    });

    // Use authenticate() from SDK, type assertion because TS types are incomplete
    const result = await (session as any).authenticate();

    if (result.authenticated) {
      return next();
    }

    // If not authenticated, clear cookie and redirect
    res.clearCookie('wos-session', { path: '/' });
    return res.redirect('http://localhost:5173/login');
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.clearCookie('wos-session', { path: '/' });
    return res.redirect('http://localhost:5173/login');
  }
}

// ---------------------------
// Routes
// ---------------------------

// Login
app.get('/login', (req: Request, res: Response) => {
  try {
    const authorizationUrl = workos.userManagement.getAuthorizationUrl({
      provider: 'authkit',
      redirectUri: 'http://localhost:3000/callback',
      clientId: process.env.WORKOS_CLIENT_ID!,
    });
    res.redirect(authorizationUrl);
  } catch (err) {
    console.error('Error generating authorization URL:', err);
    res.status(500).send('Internal Server Error');
  }
});

// Callback
app.get('/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string | undefined;
  if (!code) return res.status(400).send('No code provided');

  try {
    const authenticateResponse = await workos.userManagement.authenticateWithCode({
      clientId: process.env.WORKOS_CLIENT_ID!,
      code,
      session: {
        sealSession: true,
        cookiePassword: process.env.WORKOS_COOKIE_PASSWORD!,
      },
    });

    const { sealedSession } = authenticateResponse as any; // type assertion

    res.cookie('wos-session', sealedSession, {
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
    });

    res.redirect('http://localhost:5173/profile');
  } catch (error) {
    console.error('Authentication error:', error);
    res.redirect('http://localhost:5173/login');
  }
});

// Protected profile route
app.get('/profile', withAuth, async (req: Request, res: Response) => {
  try {
    const sessionCookie = req.cookies['wos-session'];
    if (!sessionCookie) {
      return res.redirect('http://localhost:5173/login');
    }

    const session = workos.userManagement.loadSealedSession({
      sessionData: sessionCookie,
      cookiePassword: process.env.WORKOS_COOKIE_PASSWORD!,
    });

    // Authenticate session
    const authResult = await (session as any).authenticate();

    if (!authResult.authenticated || !authResult.user) {
      res.clearCookie('wos-session', { path: '/' });
      return res.redirect('http://localhost:5173/login');
    }

    // Extract user directly from session
    const user = authResult.user;

    res.json({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Logout
app.get('/logout', async (req: Request, res: Response) => {
  try {
    const sessionCookie = req.cookies['wos-session'];

    res.clearCookie('wos-session', {
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
    });

    if (!sessionCookie) {
      return res.redirect('http://localhost:5173/login');
    }

    const session = workos.userManagement.loadSealedSession({
      sessionData: sessionCookie,
      cookiePassword: process.env.WORKOS_COOKIE_PASSWORD!,
    });

    const url = await (session as any).getLogoutUrl({
      returnTo: 'http://localhost:5173/login',
    });

    res.redirect(url);
  } catch (error) {
    console.error('Logout error:', error);
    res.redirect('http://localhost:5173/login');
  }
});

// Health check
app.get('/', (req: Request, res: Response) => {
  res.send('Server is running...');
});

// Start server
connectDB()
  .then(() => {
    console.log('Database connection established...');
    app.listen(PORT, () => {
      console.log(`Server is listening on port ${PORT}…`);
    });
  })
  .catch((err: unknown) => {
    console.error('Database cannot be connected!!', err);
    process.exit(1);
  });
