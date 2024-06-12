const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

// middleware
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = req.headers.authorization;
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gjqtths.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Collections
    const requestsCollection = client.db("bloodbondDB").collection("requests");
    const usersCollection = client.db("bloodbondDB").collection("users");
    const blogsCollection = client.db("bloodbondDB").collection("blogs");
    const fundsCollection = client.db("bloodbondDB").collection("funds");

    // auth related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res.send({ token });
    });

    // Verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "fobidden access" });
      }
      next();
    };

    // Verify admin
    const verifyVolunteer = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isVolunteer = user?.role === "volunteer";
      if (!isVolunteer) {
        return res.status(403).send({ message: "fobidden access" });
      }
      next();
    };

    // Users related api
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // get a user info by email from db
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send(result);
    });

    app.put("/user/:email", async (req, res) => {
      const userData = req.body;
      const email = req.params.email;
      const query = { email };
      const updatedUser = {
        $set: {
          ...userData,
        },
      };
      const result = await usersCollection.updateOne(query, updatedUser);
      res.send(result);
    });

    // Update user role
    app.patch(
      "/user/update/:email",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const user = req.body;
        const query = { email };
        const updateDoc = {
          $set: { ...user },
        };
        const result = await usersCollection.updateOne(query, updateDoc);
        res.send(result);
      }
    );

    app.get("/user/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get(
      "/user/volunteer",
      verifyToken,
      verifyVolunteer,
      async (req, res) => {
        console.log(req.headers);
        const result = await usersCollection.find().toArray();
        res.send(result);
      }
    );

    // Post data to requests collection
    app.post("/requests", verifyToken, async (req, res) => {
      const requestData = req.body;
      const result = await requestsCollection.insertOne(requestData);
      res.send(result);
    });

    // get data from requests collection
    app.get("/requests", async (req, res) => {
      const result = await requestsCollection.find().toArray();
      res.send(result);
    });

    // Donate and update request
    app.patch("/request/update/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const request = req.body;
      const query = { _id: new ObjectId(id) };
      const updatedRequest = {
        $set: { ...request },
      };
      const result = await requestsCollection.updateOne(query, updatedRequest);
      res.send(result);
    });

    app.get("/my-requests/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { requester_email: email };
      const result = await requestsCollection.find(query).toArray();
      res.send(result);
    });

    // get single data from requests collection
    app.get("/requests/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await requestsCollection.findOne(query);
      res.send(result);
    });

    // Blog related api
    app.post("/blogs", verifyToken, verifyAdmin, async (req, res) => {
      const blog = req.body;
      const result = await blogsCollection.insertOne(blog);
      res.send(result);
    });

    // Get blogs from blogs collection
    app.get("/blogs", async (req, res) => {
      const result = await blogsCollection.find().toArray();
      res.send(result);
    });

    // Get single blog from blogs collection
    app.get("/blog/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await blogsCollection.findOne(query);
      res.send(result);
    });

    // delete single blog from blogs collection
    app.delete("/blog/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await blogsCollection.deleteOne(query);
      res.send(result);
    });

    // Update status of blog
    app.patch("/blog/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const blog = req.body;
      const query = { _id: new ObjectId(id) };
      const updateBlog = {
        $set: { ...blog },
      };
      const result = await blogsCollection.updateOne(query, updateBlog);
      res.send(result);
    });

    // Update specific data
    app.put("/request/:id", async (req, res) => {
      const requestData = req.body;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const option = { upsert: true };
      const updatedRequest = {
        $set: {
          ...requestData,
        },
      };
      const result = await requestsCollection.updateOne(
        query,
        updatedRequest,
        option
      );
      res.send(result);
    });

    // Delete a request
    app.delete("/my-requests/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await requestsCollection.deleteOne(query);
      res.send(result);
    });

    // Logout
    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
        console.log("Logout successful");
      } catch (err) {
        res.status(500).send(err);
      }
    });

    // Payment intent
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // Save transactions to database
    app.post("/funds", verifyToken, async (req, res) => {
      const paymentData = req.body;
      const result = await fundsCollection.insertOne(paymentData);
      res.send(result);
    });

    // get transactions from database
    app.get("/funds", verifyToken, async (req, res) => {
      const result = await fundsCollection.find().toArray();
      res.send(result);
    });

    // get specified transactions from database for email
    app.get("/fund/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await fundsCollection.find(query).toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello from BloodBond Server..");
});

app.listen(port, () => {
  console.log(`BloodBond is running on port ${port}`);
});
