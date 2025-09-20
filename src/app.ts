import express from 'express';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB } from './config/database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(morgan('dev'));

app.get('/', (req, res) => {
res.send('Hello, world!');
});

connectDB()
.then(() => {
console.log('Database connection established...');
app.listen(PORT, () => {
console.log(`Server is successfully listening on port ${PORT}…`);
});
})
.catch((err) => {
console.error('Database cannot be connected!!', err);
process.exit(1);
});