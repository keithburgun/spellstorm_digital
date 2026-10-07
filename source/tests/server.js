const express=require('express');const {ExpressPeerServer}=require('peer');const app=express();
const srv=app.listen(9000,'127.0.0.1',()=>console.log('peer server up on 127.0.0.1:9000'));
app.use('/ss',ExpressPeerServer(srv,{path:'/'}));
