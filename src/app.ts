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
    first_name: string;
    last_name: string;
    email: string;
  };
}

// ---------------------------
// Middleware
// ---------------------------
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan('dev'));
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
      first_name: authResult.user.first_name,
      last_name: authResult.user.last_name,
      email: authResult.user.email,
    };

    // Automatically create user in MongoDB if not exists
    let dbUser = await UserModel.findOne({ email: req.user.email });
    if (!dbUser) {
      dbUser = await UserModel.create({
        name: `${req.user.first_name} ${req.user.last_name}`,
        email: req.user.email,
        role: 'sales', // default role
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
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        role: 'sales', // default role
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
  res.json(req.user);
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
// Example CRUD routes
// ---------------------------

// Create a new user manually (still works)
app.post('/users', withAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { first_name, last_name, email, role } = req.body;

    if (!first_name || !last_name || !email) {
      return res.status(400).json({ error: 'first_name, last_name, and email are required' });
    }

    const name = `${first_name} ${last_name}`;

    const user = await UserModel.create({
      name,
      email,
      role: role || 'sales',
    } as IUser);

    res.status(201).json(user);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to create user' });
  }
});

// Get all users
app.get('/users', withAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await UserModel.find();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
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
