const express = require("express");
const mysql = require("mysql");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const path = require("path");
const app = express();
// const cloudinary = require("./utits/cloudinary");
const cloudinary = require('cloudinary').v2;
const dotenv = require('dotenv');
dotenv.config();
const port = process.env.PORT || 8000;

app.use(
  cors({
    origin: process.env.HOST, // Only allow requests from this origin
    methods: ["GET", "POST", "PUT", "DELETE"], // Only allow specified HTTP methods
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());
app.use("/a", express.static("/b"));
app.use(express.static(__dirname + "/public"));
app.use("/uploads", express.static("uploads"));

const con = mysql.createConnection({
  host: process.env.SQLHOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: process.env.DATABASE,
});

// Multer middleware
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/images");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "_" + file.originalname);
  },
});
var upload = multer({ storage: storage });

// Cloudinary Image Upload 
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
});

// Database Connection
con.connect(function (err) {
  if (err) console.log(err);
  else console.log("DB connected!");
});

let userID = "";
let refreshtoken = "";

app.get("/dashboard", async (req, res) => {
  const token = refreshtoken;
  // console.log(token);
  try {
    // const token = req.cookies.token;
    jwt.verify(token, process.env.JWT_SECRET_KEY, (err, result) => {
      if (err) {
        return res.json({ Status: "Failed" });
      }
      return res.json({ Status: "Success" });
    });
  } catch (error) {
    console.error(error);
    return res.json({ Status: "Failed", Error: error.message });
  }
});

// Login API
app.post("/login", (req, res) => {
  const query = "SELECT * FROM users WHERE email = ? AND password = ?";
  con.query(query, [req.body.email, req.body.password], (err, result) => {
    if (err)
      return res.json({ Status: "Error", Error: "Error in running Query!" });
    if (result.length > 0) {
      const id = result[0].id;
      const token = jwt.sign({ id }, process.env.JWT_SECRET_KEY, {
        expiresIn: "1min",
      });
      // res.cookie("token", token);
      refreshtoken = token;
      // console.log(result);
      userID = id;
      // console.log(userID)
      return res.json({ Status: "Success" });
    } else
      return res.json({ Status: "Error", Error: "Wrong Email or Password!" });
  });
});

// getuser details
app.get("/getuser", (req, res) => {
  const query = "select `name`, `email` from users where id = ?";
  con.query(query, [userID], (err, result) => {
    if (err) return res.json({ Error: "Get users error!" });
    else return res.json({ Status: "Success", Result: result });
  });
});

// Creating new employ
app.post("/create", upload.single("image"), function (req, res) {
  cloudinary.uploader.upload(req.file.path, (err, result) => {
    if (err) {
      console.log(err);
      return res.json({ Error: "ERROR!" });
    }
    const query =
      "insert into employee(`name`, `email`, `password`, `address`,`image`, `salary`) values (?)";
    bcrypt.hash(req.body.password.toString(), 10, (err, hash) => {
      if (err) return res.json({ Error: "Error in hashing password!" });
      const values = [
        req.body.name,
        req.body.email,
        hash,
        req.body.address,
        result.secure_url,
        req.body.salary,
      ];
      // console.log(values[4]);
      con.query(query, [values], (err, result) => {
        if (err) return res.json({ Error: "Inside signup query" });
        else return res.json({ Status: "Success" });
      });
    });
  });
});

// Displaying all employees
app.get("/getEmployees", (req, res) => {
  const query = "select * from employee";
  con.query(query, (err, result) => {
    if (err) return res.json({ Error: "Get employee error!" });
    else return res.json({ Status: "Success", Result: result });
  });
});

// Updating an employee
app.put("/update/:id", (req, res) => {
  const id = req.params.id;
  const { name, email, address, salary } = req.body;
  const query =
    "UPDATE employee SET name = ?, email = ?, address = ?, salary = ? WHERE id = ?";
  con.query(query, [name, email, address, salary, id], (err, result) => {
    if (err) {
      return res.json({ Error: "Update employee error!" });
    } else {
      console.log(result);
      return res.json({ Status: "Success", Result: result });
    }
  });
});

// Getting a particular employing by clicking edit
app.get("/get/:id", (req, res) => {
  const id = req.params.id;
  const query = "select * from employee where id = ?";
  con.query(query, [id], (err, result) => {
    if (err) return res.json({ Error: "Get employee error!" });
    else {
      return res.json({ Status: "Success", Result: result });
    }
  });
});

// Getting a particular employing by clicking edit
app.delete("/delete/:id", (req, res) => {
  const id = req.params.id;
  const query = "delete from employee where id = ?";
  con.query(query, [id], (err, result) => {
    if (err) return res.json({ Error: "Delete employee error!" });
    else {
      return res.json({ Status: "Success", Result: result });
    }
  });
});

// Getting admin profile
app.get("/adminprofile", (req, res) => {
  const query = "select `name`, `email`, `image` from users where id = ?";
  con.query(query, [userID], (err, result) => {
    if (err) console.log(err);
    else {
      // console.log(result);
      return res.json({ Status: "Success", Result: result });
    }
  });
});

// Handling logout
app.get("/logout", (req, res) => {
  refreshtoken = "";
  userID = "";
  // res.clearCookie('token');
  return res.json({ Status: "Logged out" });
});

app.get("/", (req, res) => {
  res.send("Welcome to the backend of EMS!");
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
