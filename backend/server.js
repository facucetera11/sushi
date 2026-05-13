require("dotenv").config();

const express=require("express");
const mongoose=require("mongoose");
const cors=require("cors");
const Product=require("./models/Product");

const app=express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("Mongo conectado"))
.catch(err=>console.log(err));

app.get("/products",async(req,res)=>{
res.json(await Product.find());
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

app.post("/buy/:id",async(req,res)=>{
const product=await Product.findById(req.params.id);

if(product.stock>0){
product.stock--;
await product.save();
res.json(product);
}else{
res.status(400).json({message:"Sin stock"});
}
});

app.listen(5000,()=>{
console.log("Servidor corriendo en puerto 5000");
});