//libs
const express = require('express')
const hbs = require('express-handlebars')
const mysql = require('mysql2/promise')
const fetch = require("node-fetch")
const withQuery = require("with-query").default
const morgan = require("morgan")

//config PORT
const PORT = parseInt(process.argv[2]) || parseInt(process.env.PORT)

//SQL
const SQL_SELECT_BOOKS_ALPHABET = 'select * from book2018 WHERE title LIKE ? limit ? offset ?'
const SQL_FIND_BY_BOOK_ID = 'select * from book2018 where book_id = ?'
const SQL_BOOKS_COUNT = 'select count(*) as book_count from book2018 where title LIKE ?'

// reviews
const URL = 'https://api.nytimes.com/svc/books/v3/reviews.json';
const API_KEY = process.env.API_KEY || '';

// configure connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT), 
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionLimit: 4, 
    timezone: '+08:00'
})

// express and configure hbs
const app = express()
app.use(morgan('combined'))
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
        let count = await conn.query(SQL_BOOKS_COUNT,[`${req.params.letter}%`])
        // console.log(result[0]);
        // console.log(count[0][0].book_count);
        let bookCount = count[0][0].book_count;
        res.status(200)
        res.type('text/html')
        res.render('books',{
            book: result[0],
            letter: req.params.letter,
            prevOffset: Math.max(0, offset - limit),
            nextOffset: offset + limit,
            empty: offset<=0,
            max: (bookCount-offset)<=10,
        })
    } catch (e) {
        console.log(e);
        res.status(500)
		res.type('text/html')
		res.send(e)
    } finally {
        conn.release()
    }
})

app.get("/book/:bookid",async(req,res)=>{
    // console.log(req.params.bookid);
    const conn = await pool.getConnection()

    try {
        /************************************/
        let result = await conn.query(SQL_FIND_BY_BOOK_ID, [req.params.bookid])
        // console.log(result[0][0]);
        let bookresult = result[0][0];
        let regex = /[|]/g;
        // console.log(bookresult.authors.replace(regex,","));
        bookresult.authors = bookresult.authors.replace(regex,", ")
        bookresult.genres = bookresult.genres.replace(regex,", ")
        let bookJSformat = [bookresult].map((e)=>{
            return {
                bookId: e.book_id,
                title: e.title,
                authors: e.authors.split(", "),
                summary: e.description,
                pages: e.pages,
                rating: e.rating,
                ratingCount: e.rating_count,
                genres: e.genres.split(", ")
            }
        })
        // console.log(bookresult);
        res.status(200)
        // res.type('text/html')
        res.format({
            'text/html' : () => {
                res.type('text/html')
                res.render('bookDetails',{book: bookresult})
            },
            'application/json': () => {
                res.type('application/json')
                res.json(bookJSformat)
            },
            'default': () => {
                res.type('text/plain')
                res.send(JSON.stringify(bookresult))
            }
        })
    } catch (e) {
        console.log(e);
        res.status(500)
		res.type('text/html')
		res.send(e)
    } finally {
        conn.release()
    }
})

app.post('/searchReview',express.urlencoded({extended: true}), async(req,res)=>{
    // console.log(req.body);

    const url = withQuery(
        URL,
        {
            author: req.body.author,
            title: req.body.title,
            "api-key": API_KEY,
        }
    )

    // console.log(url);
    
    let resultURL = await fetch(url)
    
    let jsResult = await resultURL.json();
    
    // console.log(jsResult.results);

    const bookReview = jsResult.results
    .map((e)=>{
        return {
            title: e.book_title, 
            author: e.book_author, 
            reviewer: e.byline,
            reviewDate: e.publication_dt,
            summary: e.summary,
            reviewUrl: e.url
        }
    })

    // console.log(bookReview);

    res.status(200)
    res.type("text/html")
    res.render('bookReview', {
        bookReview,
        empty: jsResult.results.length <=0
    })
})

app.use(express.static(__dirname + '/static')) 
// app.use((req,res)=>{
//     res.redirect('/')
// })

startApp(app,pool);