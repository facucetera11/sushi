app.get("/seed", async (req, res) => {

try {

await Product.deleteMany();

await Product.insertMany([

{
name: "California Roll",
price: 6500,
stock: 20,
image: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c",
category: "rolls"
},

{
name: "Philadelphia Roll",
price: 7200,
stock: 15,
image: "https://images.unsplash.com/photo-1553621042-f6e147245754",
category: "rolls"
},

{
name: "Combo Premium",
price: 18000,
stock: 10,
image: "https://images.unsplash.com/photo-1611143669185-af224c5e3252",
category: "combos"
},

{
name: "Veggie Roll",
price: 5900,
stock: 12,
image: "https://images.unsplash.com/photo-1563612116625-3012372fccce",
category: "veggie"
},

{
name: "Bandeja 40 piezas",
price: 26000,
stock: 8,
image: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351",
category: "bandejas"
},

{
name: "Salsa Teriyaki",
price: 1500,
stock: 30,
image: "https://images.unsplash.com/photo-1604908176997-4317c5f2d5b5",
category: "extras"
}

]);

res.json({
message: "Productos cargados"
});

} catch (err) {

console.log(err);

res.status(500).json({
message: err.message
});

}

});