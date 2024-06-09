const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");

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
  console.log("inside verify token:", req.headers.authorization);
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = req.headers.authorization;
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
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

    // auth related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res.send({ token });
      // res
      //   .cookie("token", token, {
      //     httpOnly: true,
      //     secure: process.env.NODE_ENV === "production",
      //     sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      //   })
      //   .send({ success: true });
    });

    // Users related api
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users", verifyToken, async (req, res) => {
      console.log(req.headers);
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // Post data to requests collection
    app.post("/requests", async (req, res) => {
      const requestData = req.body;
      const result = await requestsCollection.insertOne(requestData);
      res.send(result);
    });

    // get data from requests collection
    app.get("/requests", async (req, res) => {
      const result = await requestsCollection.find().toArray();
      res.send(result);
    });

    app.get("/my-requests/:email", async (req, res) => {
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
    app.delete("/my-requests/:id", async (req, res) => {
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
