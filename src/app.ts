import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB } from './config/database.js';
import { WorkOS } from '@workos-inc/node';
import cookieParser from 'cookie-parser';
import cors from 'cors';

// Models
import UserModel from './models/User.js';
import type { IUser } from './models/types.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------
// TypeScript types
// ---------------------------
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profilePictureUrl: string;
  };
}

// ---------------------------
// Middleware
// ---------------------------
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
// app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json());

// ---------------------------
// Environment check
// ---------------------------
if (!process.env.WORKOS_API_KEY || !process.env.WORKOS_CLIENT_ID || !process.env.WORKOS_COOKIE_PASSWORD) {
  console.error('Missing required environment variables!');
  process.exit(1);
}

// ---------------------------
// WorkOS client
// ---------------------------
const workos = new WorkOS(process.env.WORKOS_API_KEY, {
  clientId: process.env.WORKOS_CLIENT_ID,
});

// ---------------------------
// Auth middleware
// ---------------------------
async function withAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const sessionCookie = req.cookies['wos-session'];
  if (!sessionCookie) return res.redirect('http://localhost:5173/login');

  try {
    const session = workos.userManagement.loadSealedSession({
      sessionData: sessionCookie,
      cookiePassword: process.env.WORKOS_COOKIE_PASSWORD!,
    });

    const authResult = await (session as any).authenticate();

    if (!authResult.authenticated || !authResult.user) {
      res.clearCookie('wos-session', { path: '/' });
      return res.redirect('http://localhost:5173/login');
    }

    req.user = {
      id: authResult.user.id,
      firstName: authResult.user.firstName,
      lastName: authResult.user.lastName,
      email: authResult.user.email,
      profilePictureUrl: authResult.user.profilePictureUrl,
    };
    

    // Automatically create user in MongoDB if not exists
    let dbUser = await UserModel.findOne({ email: req.user.email });
    if (!dbUser) {
      dbUser = await UserModel.create({
        name: `${req.user.firstName} ${req.user.lastName}`,
        email: req.user.email,
        role: 'sales', // default role
        profilePictureUrl: req.user.profilePictureUrl,
      } as IUser);
      console.log(`Created new user in DB: ${dbUser.email}`);
    }

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.clearCookie('wos-session', { path: '/' });
    return res.redirect('http://localhost:5173/login');
  }
}

// ---------------------------
// Routes
// ---------------------------

// Health check
app.get('/', (req: Request, res: Response) => {
  res.send('Server is running...');
});

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

    const { sealedSession, user } = authenticateResponse as any;

    // Automatically create user in MongoDB if not exists
    let dbUser = await UserModel.findOne({ email: user.email });
    if (!dbUser) {
      dbUser = await UserModel.create({
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: 'sales', // default role
        profilePictureUrl: user.profilePictureUrl,
      } as IUser);
      console.log(`Created new user in DB: ${dbUser.email}`);
    }

    // Set WorkOS session cookie
    res.cookie('wos-session', sealedSession, {
      path: '/',
      httpOnly: true,
      secure: false, // set true in production
      sameSite: 'lax',
    });

    res.redirect('http://localhost:5173/profile');
  } catch (error) {
    console.error('Authentication error:', error);
    res.redirect('http://localhost:5173/login');
  }
});

// Profile
app.get('/profile', withAuth, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'User not authenticated',
        message: 'No user data found in request'
      });
    }

    const profileData = {
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      email: req.user.email,
      profilePictureUrl: req.user.profilePictureUrl
    };

    res.json(profileData);
  } catch (error) {
    console.error('Profile endpoint error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to retrieve profile data'
    });
  }
});

// Logout
app.get('/logout', withAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const sessionCookie = req.cookies['wos-session'];

    res.clearCookie('wos-session', {
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
    });

    if (!sessionCookie) return res.redirect('http://localhost:5173/login');

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



// ---------------------------
// Start server with connectDB
// ---------------------------
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
