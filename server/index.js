import express from "express";
import logger from 'morgan'
import { Server } from "socket.io";
import { createServer } from "node:http";
import { Socket } from "node:dgram";
import { createClient } from "@libsql/client";

import dotenv from 'dotenv'

dotenv.config();

const port = process.env.PORT ?? 3000;

const db = createClient({
    url: "libsql://splendid-multiple-man-friendzone09.turso.io",
    authToken: process.env.DB_TOKEN
});

await db.execute(
    `CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        content TEXT,
        user TEXT
    )`
);

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.static("client"));

io.on('connection', async (socket)=>{
    console.log('usuario conectado')
    
    socket.on('chat message', async (msg)=>{
        let result;
        const username = socket.handshake.auth.username ?? 'anonymus';
        try{
            result = await db.execute({
                sql: `INSERT INTO messages (content, user) values (:msg, :username)`,
                args: {msg, username}
            })
        }catch (e){
            console.error(e);
            return
        }

        io.emit('chat message', msg, result.lastInsertRowid.toString(), username);
    })

    if(!socket.recovered){
        try{
            const results = await db.execute({
                sql: 'SELECT * FROM messages WHERE id > ?',
                args: [socket.handshake.auth.serverOffset ?? 0]

            })

            results.rows.forEach((row) =>{
                socket.emit('chat message', row.content, row.id.toString(), row.user);
            });
            
        }
         catch(e){
            console.error(e)
            return
        }
    }
})

app.use(logger('dev'));

app.get('/', (req, res)=>{
    res.sendFile(process.cwd() + '/client/index.html')
});

server.listen(port, ()=>{
    console.log(`server corriendo en : ${port}`)
})
