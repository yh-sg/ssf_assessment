//libs
const express = require('express')
const hbs = require('express-handlebars')
const mysql = require('mysql2/promise')

//config PORT
const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT) || 3000

//SQL
const SQL_SELECT_BOOKS_ALPHABET = 'select * from book2018 WHERE title LIKE ? limit ? offset ?'

// configure connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306, 
    database: process.env.DB_NAME || 'goodreads',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionLimit: 4, 
    timezone: '+08:00'
})

// express and configure hbs
const app = express()
app.engine('hbs', hbs({ defaultLayout: 'default.hbs' }))
app.set('view engine', 'hbs')

const startApp = async(app,pool) => {
    try{
        // acquire a connection from the connection pool
        const conn = await pool.getConnection();

        console.log('Pinging database....');
        await conn.ping();
        //release the connection
        conn.release();

        app.listen(PORT,()=>{
            console.log(`App is running on ${PORT} at ${new Date()}`,);
        })

    }catch(e){
        console.log(`Cannot ping database: `,e);
    }
}

app.get('/',async(req,res)=>{
    // const conn = await pool.getConnection()

    try {
            res.status(200)
            res.type('text/html')
            res.render('landing')
        } catch (error) {
            res.status(500)
            res.type('text/html')
            res.send(JSON.stringify(e))
        }
})

app.get("/books/:letter",async(req,res)=>{
    // console.log(req.params.letter);
    const conn = await pool.getConnection()
    const offset = parseInt(req.query['offset']) || 0;
    const limit = 10;

    try {
        let result = await conn.query(SQL_SELECT_BOOKS_ALPHABET,[`${req.params.letter}%`, limit, offset])
        console.log(result[0]);
        res.status(200)
        res.type('text/html')
        res.render('books',{
            book: result[0],
            letter: req.params.letter,
            prevOffset: Math.max(0, offset - limit),
            nextOffset: offset + limit,
            empty: result[0].length<=0
        })
    } catch (e) {
        console.log(e);
    } finally {
        conn.release()
    }
})

startApp(app,pool);