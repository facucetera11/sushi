const mongoose=require("mongoose");

const OrderSchema=new mongoose.Schema({
number:Number,
items:Array,
total:Number,
status:{
type:String,
default:"Pendiente"
},
createdAt:{
type:Date,
default:Date.now
}
});

module.exports=mongoose.model("Order",OrderSchema);