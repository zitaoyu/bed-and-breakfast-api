// Import required packages and modules
const serverless = require("serverless-http");

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const User = require("./models/User.js");
const Place = require("./models/Place.js");
const Booking = require("./models/Booking.js");
const download = require("image-downloader");
const fs = require("fs");
const AWSS3 = require("@aws-sdk/client-s3");
const multer = require("multer");
const mime = require("mime-types");
require("dotenv").config();

// Configuration
const bcryptSalt = bcrypt.genSaltSync(12);
const jwtSecret = process.env.JWT_SECRET;

// Initialize Express app
const app = express();

// Middleware setup
app.use(express.json()); // Parse incoming request bodies in JSON format
app.use(cookieParser()); // Parse cookies attached to requests

// Connect to MongoDB database
mongoose.connect(process.env.MONGO_URL);

const bucket = process.env.BUCKET;
const region = process.env.AWS_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY_ID;

async function uploadImageToS3(path, newFilename, mimetype) {
  const client = new AWSS3.S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  const command = new AWSS3.PutObjectCommand({
    Bucket: bucket,
    Body: fs.readFileSync(path),
    Key: newFilename,
    ContentType: mimetype,
  });
  await client.send(command);
  return `https://${bucket}.s3.amazonaws.com/${newFilename}`;
}

function getUserDataFromToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
      if (err) {
        throw err;
      }
      resolve(userData);
    });
  });
}

// Route for user registration
app.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res
        .status(409)
        .json({ error: "An account with this email already exists." });
    } else {
      // Create a new user in the database
      const userDoc = await User.create({
        name,
        email,
        password: bcrypt.hashSync(password, bcryptSalt), // Hash the user's password
      });
      res.json(userDoc);
    }
  } catch (error) {
    res.status(422).json({ error });
  }
});

// Route for user profile update
app.put("/register", async (req, res) => {
  const { name, email, password } = req.body;
  const { token } = req.cookies;

  if (token) {
    const userData = await getUserDataFromToken(token);
    const userDoc = await User.findById(userData.id);
    // if new password provided
    if (password) {
      userDoc.set({
        name,
        email,
        password: bcrypt.hashSync(password, bcryptSalt),
      });
    } else {
      userDoc.set({
        name,
        email,
        password: userDoc.password,
      });
    }
    userDoc.save();
    jwt.sign(
      {
        email,
        id: userData.id,
      },
      jwtSecret,
      {},
      (err, token) => {
        if (err) {
          throw err;
        }
        res
          .cookie("token", token, { sameSite: "none", secure: true })
          .json(userDoc);
      }
    );
  }
});

// Route for user login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  // Check if the user exists in the database
  const userDoc = await User.findOne({ email });
  if (userDoc) {
    const isPasswordCorrect = bcrypt.compareSync(password, userDoc.password); // Compare passwords
    if (isPasswordCorrect) {
      // Generate a JWT token and set it as a cookie
      jwt.sign(
        {
          email: userDoc.email,
          id: userDoc._id,
        },
        jwtSecret,
        {},
        (err, token) => {
          if (err) {
            throw err;
          }
          res
            .cookie("token", token, { sameSite: "none", secure: true })
            .json(userDoc); // Respond with user data and set token cookie
        }
      );
    } else {
      res.status(401).json({ error: "Incorrect Password." });
    }
  } else {
    res.status(401).json({ error: "Incorrect Email." });
  }
});

app.post("/logout", (req, res) => {
  // return empty cookie
  res.cookie("token", "", { sameSite: "none", secure: true }).json(true);
});

// Route to retrieve user profile using token
app.get("/profile", async (req, res) => {
  const { token } = req.cookies;
  if (token) {
    // Verify token and return user data if valid
    const userData = await getUserDataFromToken(token);
    if (userData) {
      const { name, email, _id } = await User.findById(userData.id);
      res.json({ name, email, _id });
    } else {
      res.status(401).json({ error: "Invalid token." });
    }
  } else {
    res.status(401).json({ error: "User not logged in." });
  }
});

app.post("/upload-by-link", async (req, res) => {
  const { url } = req.body;
  const newName = "photo_" + Date.now() + ".jpg";
  const dest = "/tmp/" + newName;

  await download.image({ url, dest });
  const S3ImageUrl = await uploadImageToS3(dest, newName, mime.lookup(dest));
  res.json({ url: S3ImageUrl });
});

const photosMiddleware = multer({ dest: "/tmp" });
app.post("/upload", photosMiddleware.array("photos", 10), async (req, res) => {
  const uploadedFilesLinks = [];
  for (let i = 0; i < req.files.length; i++) {
    const { originalname, path, mimetype } = req.files[i];
    const fileExtension = originalname.split(".").pop();
    const newName = "photo_" + Date.now() + "." + fileExtension;
    const S3ImageUrl = await uploadImageToS3(path, newName, mimetype);
    uploadedFilesLinks.push(S3ImageUrl);
  }
  res.json({ urls: uploadedFilesLinks });
});

app.get("/places", async (req, res) => {
  res.json(await Place.find());
});

app.get("/places/:id", async (req, res) => {
  const { id } = req.params;
  const placeData = await Place.findById(id);
  res.json(placeData);
});

app.get("/user-places", async (req, res) => {
  const { token } = req.cookies;
  if (token) {
    const userData = await getUserDataFromToken(token);
    res.json(await Place.find({ owner: userData.id }));
  } else {
    res.json({ error: "User not not logged in." });
  }
});

app.post("/user-places", async (req, res) => {
  const { token } = req.cookies;
  // extract data from request body
  const {
    title,
    address,
    addedPhotos,
    description,
    perks,
    extraInfo,
    checkIn,
    checkOut,
    maxGuests,
    price,
  } = req.body;

  if (token) {
    const userData = await getUserDataFromToken(token);
    const placeDoc = await Place.create({
      owner: userData.id,
      title,
      address,
      photos: addedPhotos,
      description,
      perks,
      extraInfo,
      checkIn,
      checkOut,
      maxGuests,
      price,
    });
    res.json(placeDoc);
  } else {
    res.json({ error: "User not not logged in." });
  }
});

app.put("/user-places", async (req, res) => {
  const { token } = req.cookies;
  // extra data from request body
  const {
    id,
    title,
    address,
    addedPhotos,
    description,
    perks,
    extraInfo,
    checkIn,
    checkOut,
    maxGuests,
    price,
  } = req.body;

  if (token) {
    const userData = await getUserDataFromToken(token);
    const placeDoc = await Place.findById(id);

    if (userData.id === placeDoc.owner.toString()) {
      placeDoc.set({
        title,
        address,
        photos: addedPhotos,
        description,
        perks,
        extraInfo,
        checkIn,
        checkOut,
        maxGuests,
        price,
      });
      placeDoc.save();
      res.json(placeDoc);
    }
  } else {
    res.json({ error: "User not not logged in." });
  }
});

app.delete("/user-places", async (req, res) => {
  const { token } = req.cookies;

  if (token) {
    const userData = await getUserDataFromToken(token);
    const { id } = req.body;
    const placeDoc = await Place.findById(id);

    if (userData.id === placeDoc.owner.toString()) {
      try {
        await Place.deleteOne({ _id: id });
        res.json("Place deleted successfully");
      } catch (error) {
        res.status(500).json({ error: "Failed to delete the place" });
      }
    }
  } else {
    res.json({ error: "User not not logged in." });
  }
});

app.get("/bookings", async (req, res) => {
  const { token } = req.cookies;
  if (token) {
    const userData = await getUserDataFromToken(token);
    res.json(await Booking.find({ booker: userData.id }));
  } else {
    res.json({ error: "User not not logged in." });
  }
});

app.post("/bookings", async (req, res) => {
  const { booker, place, checkInDate, checkOutDate, guests, total } = req.body;
  const { token } = req.cookies;
  if (token) {
    // const userData = await getUserDataFromToken(token);
    const bookingDoc = await Booking.create({
      booker,
      place,
      checkInDate,
      checkOutDate,
      guests,
      total,
    });
    res.json(bookingDoc);
  } else {
    res.json({ error: "User not not logged in." });
  }
});

app.delete("/bookings", async (req, res) => {
  const { token } = req.cookies;

  if (token) {
    const userData = await getUserDataFromToken(token);
    const { id } = req.body;
    const BookingDoc = await Booking.findById(id);

    if (userData.id === BookingDoc.booker.toString()) {
      try {
        await Booking.deleteOne({ _id: id });
        res.json("Booking deleted successfully");
      } catch (error) {
        res.status(500).json({ error: "Failed to delete the Booking" });
      }
    }
  } else {
    res.json({ error: "User not not logged in." });
  }
});

module.exports.handler = serverless(app);
