const express=require("express");
const mongoose=require("mongoose");
const cors=require("cors");
require("dotenv").config();

const Product=require("./models/Product");
const Order=require("./models/Order");

const app=express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI);

/* SETTINGS */

const SettingsSchema=new mongoose.Schema({
openHour:Number,
closeHour:Number,
openDays:[Number]
});

const Settings=mongoose.model("Settings",SettingsSchema);

/* PRODUCTS */

app.get("/products",async(req,res)=>{
res.json(await Product.find());
});

app.post("/products",async(req,res)=>{
const p=new Product(req.body);
await p.save();
res.json(p);
});

app.put("/products/:id",async(req,res)=>{
res.json(await Product.findByIdAndUpdate(req.params.id,req.body,{new:true}));
});

app.delete("/products/:id",async(req,res)=>{
await Product.findByIdAndDelete(req.params.id);
res.json({ok:true});
});

/* SETTINGS */

app.get("/settings",async(req,res)=>{

let s=await Settings.findOne();

if(!s){
s=await Settings.create({
openHour:19,
closeHour:23,
openDays:[1,2,3,4,5,6]
});
}

res.json(s);
});

app.put("/settings",async(req,res)=>{

let s=await Settings.findOne();

if(!s)s=new Settings(req.body);
else Object.assign(s,req.body);

await s.save();
res.json(s);

});

/* ORDERS */

app.get("/orders",async(req,res)=>{
res.json(await Order.find().sort({number:-1}));
});

app.post("/orders",async(req,res)=>{

const last=await Order.findOne().sort({number:-1});

const order=new Order({
number:last?last.number+1:1,
items:req.body.items,
total:req.body.total
});

await order.save();

res.json(order);

});

app.put("/orders/:id",async(req,res)=>{
res.json(await Order.findByIdAndUpdate(req.params.id,req.body,{new:true}));
});

app.listen(process.env.PORT||5000);