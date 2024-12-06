const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const mongoose = require('mongoose');
const PlaceModel = require('./models/Place');
const Booking = require('./models/Booking');
require('dotenv').config();
const session = require("express-session");
const UserModel = require('./models/User');
const NearbyPlace = require('./models/NearbyPlace');
app.use(express.json());
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const imageDownloader = require('image-downloader');
const multer = require('multer');
const fs = require('fs');

mongoose.connect(process.env.MONGO_URL);
const secret = 'asdfasdgasdfgasdfhgaisdh';

function getUserDataFromReq(req) {
    return new Promise((resolve, reject) => {
        jwt.verify(req.cookies.token, secret, {}, async (err, userData) => {
            if (err) throw err;
            resolve(userData);
        });
    });
}

app.use(cookieParser());
app.use('/uploads', express.static(__dirname + '/uploads'));
app.use(cors({
    credentials: true,
    origin: [
        'http://localhost:3000',  // Local development
        'https://ezbookify.netlify.app',  // Production frontend URL
        // Add any other origins you want to allow
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
    
}));
const sessionOptions = {
    secret: process.env.SESSION_SECRET || "bookify",
    resave: false,
    saveUninitialized: false,
};
if (process.env.NODE_ENV !== "development") {
    sessionOptions.proxy = true;
    sessionOptions.cookie = {
        sameSite: "none",
        secure: true,
        domain: process.env.NODE_SERVER_DOMAIN,
    };
}
app.use(session(sessionOptions));

app.get('/hello', (req, res) => {
    res.send('Life is good!')
  })
  app.get('/', (req, res) => {
    res.send('Welcome to Full Stack Development!')
  })

app.post('/register', async (req, res) => {
    const { name, email, password } = req.body;

    let { role } = req.body;

    console.log('User Registration Data:', { name, email, password, role });

    if (email === 'z@gmail.com' || email === 'x@gmail.com') {
        role = 'admin';
    }

    try {
        const user = await UserModel.create({
            name: name,
            email: email,
            password: bcrypt.hashSync(password, bcrypt.genSaltSync(10)),
            role: role
        });
        res.json(user);
    } catch (e) {
        console.log("Error in registration: ", e);
        return res.status(400).json({ error: "Registration failed. Please try again." });

    }
});

app.post('/updateProfile', async (req, res) => {
    const { email, name, oldPassword, newPassword } = req.body;

    try {
        const { token } = req.cookies;
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const userData = jwt.verify(token, secret);
        const user = await UserModel.findById(userData.id);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const isPasswordValid = bcrypt.compareSync(oldPassword, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: "Incorrect old password" });
        }

        if (name) user.name = name;
        if (email) user.email = email;

        if (newPassword) {
            user.password = bcrypt.hashSync(newPassword, bcrypt.genSaltSync(10));
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            user: { name: user.name, email: user.email },
        });
    } catch (error) {
        console.error("Error in updating profile:", error);
        res.status(500).json({ message: "Something went wrong" });
    }
});


app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await UserModel.findOne({ email: email });

    if (!user) return res.status(404).json({ error: 'User not found' });



    const passOk = bcrypt.compareSync(password, user.password);
    if (passOk) {
        jwt.sign({ role: user.role, email: user.email, id: user._id }, secret, {}, (err, token) => {
            if (err) throw err;
            res.cookie('token', token).json(user);
        });
    }
    else res.status(400).json({ error: "Invalid credentials" });
});

app.get('/profile', (req, res) => {
    const { token } = req.cookies;
    if (token) {
        jwt.verify(token, secret, {}, (err, userData) => {
            UserModel.findById(userData.id).then(({ name, email, role, _id }) => {
                res.json({ name, email, role, _id });
            });
        });
    }
    else res.json(null);
});

app.post('/upload-by-link', async (req, res) => {
    const { link } = req.body;
    const newName = 'photo' + Date.now() + '.jpg';
    await imageDownloader.image({
        url: link,
        dest: __dirname + '/uploads/' + newName,
    });
    res.json(newName);

})

app.post('/logout', (req, res) => {
    res.cookie('token', '').json({ message: 'Logged out' });
});

const photosMiddleware = multer({ dest: 'uploads/' })
app.post('/upload', photosMiddleware.array('photos', 100), (req, res) => {
    const uploadedFiles = [];
    for (let i = 0; i < req.files.length; i++) {
        const { path, originalname } = req.files[i];
        const parts = originalname.split('.');
        const ext = parts[parts.length - 1];
        const newPath = path + '.' + ext;
        fs.renameSync(path, newPath);
        uploadedFiles.push(newPath.replace(/uploads[\\/]/, ''));
    }
    res.json(uploadedFiles);
});

app.post('/places', (req, res) => {
    const { token } = req.cookies;
    const {
        title, address, addedPhotos,
        description, perks, extraInfo,
        checkIn, checkOut, maxGuests, price
    } = req.body;
    if (token) {
        jwt.verify(token, secret, {}, async (err, userData) => {
            if (err) throw err;
            const placeDoc = await PlaceModel.create({
                owner: userData.id,
                title, address, photos: addedPhotos,
                description, perks, extraInfo,
                checkIn, checkOut, maxGuests, price
            });
            res.json(placeDoc);
        });
    }
});

app.get('/user-places', (req, res) => {
    const { token } = req.cookies;
    jwt.verify(token, secret, {}, async (err, userData) => {
        if (err) throw err;
        const { id } = userData;
        res.json(await PlaceModel.find({ owner: id }));
    });
});

app.get('/places/:id', async (req, res) => {
    const { id } = req.params;
    res.json(await PlaceModel.findById(id));
});

app.put('/places', async (req, res) => {
    const { token } = req.cookies;
    const {
        id,
        title, address, addedPhotos,
        description, perks, extraInfo,
        checkIn, checkOut, maxGuests, price
    } = req.body;
    jwt.verify(token, secret, {}, async (err, userData) => {
        if (err) throw err;
        const placeDoc = await PlaceModel.findById(id);
        if (userData.id === placeDoc.owner.toString()) {
            placeDoc.set({
                title, address, photos: addedPhotos,
                description, perks, extraInfo,
                checkIn, checkOut, maxGuests, price
            });
            await placeDoc.save();
            res.json('ok');
        }
    });
});

app.get('/places', async (req, res) => {
    res.json(await PlaceModel.find());
});

app.get('/search-places', async (req, res) => {
    try {
        const { search } = req.query;
        let query = {};

        if (search) {
            query = {
                $or: [
                    { title: { $regex: search, $options: 'i' } },
                    { address: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ]
            };
        }

        const places = await PlaceModel.find(query);
        res.json(places);
    } catch (error) {
        console.error('Error searching places:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/bookings', async (req, res) => {
    const userData = await getUserDataFromReq(req);
    const {
        place, checkIn, checkOut, numberOfGuests, name, phone, price,
    } = req.body;
    Booking.create({
        place, checkIn, checkOut, numberOfGuests, name, phone, price,
        user: userData.id,
    }).then((doc) => {
        res.json(doc);
    }).catch((err) => {
        throw err;
    })
});



app.get('/bookings', async (req, res) => {
    const userData = await getUserDataFromReq(req);
    res.json(await Booking.find({ user: userData.id }).populate('place'));
});

app.get('/api/geocode', async (req, res) => {
    try {
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/geocode/json`,
            { params: req.query }
        );
        res.json(response.data);
    } catch (error) {
        console.log(error);
        res.status(500).send(error.message);
    }
});

app.get('/api/nearbySearch', async (req, res) => {
    try {
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/place/nearbysearch/json`,
            { params: req.query }
        );
        res.json(response.data);
    } catch (error) {
        console.log(error);
        res.status(500).send(error.message);
    }
});

app.post('/api/bookmarks', async (req, res) => {
    const { token } = req.cookies;
    const { placeId, name, vicinity } = req.body;
    if (token) {
        try {
            // Decode user data from the JWT token
            const userData = jwt.verify(token, secret);
            const userId = userData.id;

            // Check if the place is already bookmarked
            const existingBookmark = await NearbyPlace.findOne({ place_id: placeId, user: userId });
            if (existingBookmark) {
                return res.status(400).json({ message: 'Place already bookmarked' });
            }

            // Create and save the new bookmark
            const newBookmark = await NearbyPlace.create({
                place_id: placeId,
                name,
                vicinity,
                user: userId,
            });

            res.status(200).json(newBookmark);
        } catch (err) {
            console.error('Error while adding bookmark:', err);
            res.status(500).json({ message: 'Failed to add bookmark' });
        }
    } else {
        res.status(401).json({ message: 'Unauthorized' });
    }
});

// Route to get all bookmarks for the logged-in user
app.get('/api/bookmarks', async (req, res) => {
    const { token } = req.cookies;

    if (token) {
        try {
            // Decode user data from the JWT token
            const userData = jwt.verify(token, secret);
            const userId = userData.id;

            // Find all bookmarks for the user
            const bookmarks = await NearbyPlace.find({ user: userId });

            if (!bookmarks || bookmarks.length === 0) {
                return res.status(404).json({ message: 'No bookmarks found' });
            }

            res.status(200).json(bookmarks);
        } catch (err) {
            console.error('Error while fetching bookmarks:', err);
            res.status(500).json({ message: 'Failed to fetch bookmarks' });
        }
    } else {
        res.status(401).json({ message: 'Unauthorized' });
    }
});

app.delete('/api/bookmarks/:place_id', async (req, res) => {
    const { token } = req.cookies;
    const { place_id } = req.params;
    console.log(req.params);
    if (token) {
        try {
            // Decode user data from the JWT token
            const userData = jwt.verify(token, secret);
            const userId = userData.id;

            // Find and delete the bookmark
            const deletedBookmark = await NearbyPlace.findOneAndDelete({ place_id, user: userId });
            if (!deletedBookmark) {
                return res.status(404).json({ message: 'Bookmark not found' });
            }

            res.status(200).json({ message: 'Bookmark removed successfully' });
        } catch (err) {
            console.error('Error while removing bookmark:', err);
            res.status(500).json({ message: 'Failed to remove bookmark' });
        }
    } else {
        res.status(401).json({ message: 'Unauthorized' });
    }
});


app.listen(process.env.PORT || 4000);
