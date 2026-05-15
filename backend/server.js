const express=require("express");
const mongoose=require("mongoose");
const cors=require("cors");
require("dotenv").config();

const Product=require("./models/Product");

const app=express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI);

/* ---------- SETTINGS ---------- */

const SettingsSchema=new mongoose.Schema({
openHour:Number,
closeHour:Number,
openDays:[Number]
});

const Settings=mongoose.model("Settings",SettingsSchema);

/* ---------- PRODUCTS ---------- */

app.get("/products",async(req,res)=>{
const products=await Product.find();
res.json(products);
});

app.post("/products",async(req,res)=>{
const product=new Product(req.body);
await product.save();
res.json(product);
});

app.put("/products/:id",async(req,res)=>{
const product=await Product.findByIdAndUpdate(
req.params.id,
req.body,
{new:true}
);
res.json(product);
});

app.delete("/products/:id",async(req,res)=>{
await Product.findByIdAndDelete(req.params.id);
res.json({ok:true});
});

/* ---------- SETTINGS ---------- */

app.get("/settings",async(req,res)=>{

let settings=await Settings.findOne();

if(!settings){
settings=await Settings.create({
openHour:19,
closeHour:23,
openDays:[1,2,3,4,5,6]
});
}

res.json(settings);

});

app.put("/settings",async(req,res)=>{

let settings=await Settings.findOne();

if(!settings){
settings=new Settings(req.body);
}else{
settings.openHour=req.body.openHour;
settings.closeHour=req.body.closeHour;
settings.openDays=req.body.openDays;
}

await settings.save();

res.json(settings);

});

app.listen(process.env.PORT||5000);