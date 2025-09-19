import express from 'express';
import morgan from 'morgan';

const main = async () => {
    const app = express();
    const PORT = 3000;

    app.use(morgan('dev'));

    app.get('/', (req, res) => {
        res.send('Hello, world!');
    });

    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });  
};

main().catch((err) => {
    console.error('Error starting the application:', err);
    process.exit(1); 
});
