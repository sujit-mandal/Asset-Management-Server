const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

//middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.w7djr5h.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    //Database Collection
    const usersCollection = client.db("assetDB").collection("users");
    const customRequestCollection = client
      .db("assetDB")
      .collection("customRequest");
    const assetColletion = client.db("assetDB").collection("assets");
    const employeeReqColletion = client
      .db("assetDB")
      .collection("employeeAssetRequests");

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middlewares
    const verifyToken = (req, res, next) => {
      // console.log('inside verify token', req.headers.authorization);
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      console.log(user.role);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    //Post Api
    // app.post("/add-users", async (req, res) => {
    //   const employee = req.body;
    //   const result = await usersCollection.insertOne(employee);
    //   res.send(result);
    // });

    app.post("/add-users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists", insertedId: null });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.post("/employee/create-custom-request", async (req, res) => {
      const customRequest = req.body;
      const result = await customRequestCollection.insertOne(customRequest);
      res.send(result);
    });
    app.post("/add-asset", async (req, res) => {
      const asset = req.body;
      const result = await assetColletion.insertOne(asset);
      res.send(result);
    });
    app.post("/employee/asset-request", async (req, res) => {
      const employeeRequest = req.body;
      const result = await employeeReqColletion.insertOne(employeeRequest);
      res.send(result);
    });
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      if (!price || amount < 1) {
        return;
      }
      const { client_secret } = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send(client_secret);
    });
    //Get Api
    app.get("/userData/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    // app.get("/employee/asset-list", async (req, res) => {
    //   const searchQuery = req.query.q;
    //   const type = req.query.type;
    //   const query = type ? { type } : {};
    //   if (searchQuery) {
    //     const regex = new RegExp(searchQuery, "i");
    //     query.assetName = { $regex: regex };
    //   }
    //   const result = await assetColletion.find(query).toArray();
    //   res.send(result);
    // });
    app.get("/employee/asset-list/:email", async (req, res) => {
      const userEmail = req.query.email;
      const searchQuery = req.query.q;
      const type = req.query.type;
      const query = {};
      if (userEmail) {
        query.admin = userEmail;
      }
      if (type) {
        query.type = type;
      }
      if (searchQuery) {
        const regex = new RegExp(searchQuery, "i");
        query.assetName = { $regex: regex };
      }
      const result = await assetColletion.find(query).toArray();
      res.send(result);
    });
    app.get("/admin/asset-list/:email", async (req, res) => {
      const userEmail = req.query.email;
      const searchQuery = req.query.q;
      const type = req.query.type;
      const query = {};
      if (userEmail) {
        query.admin = userEmail;
      }
      if (type) {
        query.type = type;
      }
      if (searchQuery) {
        const regex = new RegExp(searchQuery, "i");
        query.assetName = { $regex: regex };
      }
      const result = await assetColletion.find(query).toArray();
      res.send(result);
    });

    app.get("/admin/employee-all-asset-request", async (req, res) => {
      const searchQuery = req.query.q;
      const query = {};
      const regex = new RegExp(searchQuery, "i");
      const result = await employeeReqColletion
        .find({
          $or: [
            { userName: { $regex: regex } },
            { userEmail: { $regex: regex } },
          ],
        })
        .toArray();
      res.send(result);
    });

    app.get("/admin/all-custom-asset-request/:email", async (req, res) => {
      const email = req.params.email;
      console.log(email);
      const result = await customRequestCollection
        .find({ admin: email })
        .toArray();
      console.log(result);
      res.send(result);
    });
    app.get("/admin/add-employees", async (req, res) => {
      const result = await usersCollection.find({ team: false }).toArray();
      res.send(result);
    });
    app.get("/admin/all-employees/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.find({ haveAdmin: email }).toArray();
      res.send(result);
    });

    app.get("/admin/requested-asset-list", async (req, res) => {
      const searchQuery = req.query.q;
      const type = req.query.type;
      const query = type ? { type } : {};
      if (searchQuery) {
        const regex = new RegExp(searchQuery, "i");
        query.assetName = { $regex: regex };
      }
      const result = await employeeReqColletion.find(query).toArray();
      res.send(result);
    });

    app.get(
      "/employee/my-all-custom-asset-request/:email",
      async (req, res) => {
        const email = req.params.email;
        const query = { email: email };
        const result = await customRequestCollection.find(query).toArray();
        res.send(result);
      }
    );
    app.get(
      "/employee/my-all-pending-asset-request/:email",
      async (req, res) => {
        const email = req.params.email;
        const query = { userEmail: email, status: "Pending" };
        const result = await employeeReqColletion.find(query).toArray();
        res.send(result);
      }
    );
    app.get("/admin/all-pending-asset-request/:email", async (req, res) => {
      const email = req.params.email;
      const query = { admin: email, status: "Pending" };
      const result = await employeeReqColletion.find(query).limit(5).toArray();
      res.send(result);
    });
    app.get("/admin/all-asset-request/:email", async (req, res) => {
      const email = req.params.email;
      const returnQuery = { admin: email, type: "returnable" };
      const nonReturnQuery = { admin: email, type: "non-returnable" };
      const returnable = await employeeReqColletion.find(returnQuery).toArray();
      const nonReturnable = await employeeReqColletion
        .find(nonReturnQuery)
        .toArray();
      res.send({ returnable, nonReturnable });
    });
    app.get("/admin/limited-asset/:email", async (req, res) => {
      const email = req.params.email;
      const result = await assetColletion
        .find({
          quantity: { $lt: 10 },
          admin: email,
        })
        .toArray();
      res.send(result);
    });
    app.get("/admin/all-assets/:email", async (req, res) => {
      const email = req.params.email;
      const result = await assetColletion
        .find({
          admin: email,
        })
        .toArray();
      res.send(result);
    });
    app.get("/admin/all-employee/:email", async (req, res) => {
      const email = req.params.email;
      const result = await assetColletion
        .find({
          quantity: { $lt: 10 },
          admin: email,
        })
        .toArray();
      res.send(result);
    });
    app.get(
      "/employee/my-all-monthly-asset-request/:email",
      async (req, res) => {
        const email = req.params.email;
        const currentDate = new Date();
        const startOfMonth = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          1
        );
        const endOfMonth = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          0
        );

        const result = await employeeReqColletion
          .find({
            userEmail: email,
            requestDate: {
              $gte: startOfMonth.toISOString(),
              $lte: endOfMonth.toISOString(),
            },
          })
          .sort({ requestDate: -1 })
          .toArray();
        res.send(result);
      }
    );

    //Patch Api
    app.patch("/admin/extend-employee-limit/:email", async (req, res) => {
      const email = req.params.email;
      const limit = req.body.limit;
      const query = { email: email };
      const updatedDoc = {
        $set: {
          employeeLimitTotal: limit.employeeLimitTotal,
          employeeLimitRemaining: limit.employeeLimitRemaining,
        },
      };
      const result = await usersCollection.updateOne(query, updatedDoc);
      res.send(result);
    });
    app.patch("/admin/update-employeelimit/:email", async (req, res) => {
      const email = req.params.email;
      const limit = req.body.updatedEmployeelimit;
      const query = { email: email };
      const updatedDoc = {
        $set: {
          employeeLimitRemaining: limit,
        },
      };
      const result = await usersCollection.updateOne(query, updatedDoc);
      console.log(limit);
      res.send(result);
    });
    app.patch("/admin/update-employeeInfo/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const employeeInfo = req.body;
      console.log(employeeInfo);
      const updateDDoc = {
        $set: {
          haveAdmin: employeeInfo.haveAdmin,
          companylogo: employeeInfo.companylogo,
          team: employeeInfo.team,
        },
      };
      const result = await usersCollection.updateOne(query, updateDDoc);
      res.send(result);
    });

    app.patch("/admin/update-request-asset-info/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const status = req.body.status;
      const updateDDoc = {
        $set: {
          status: status,
        },
      };
      const result = await employeeReqColletion.updateOne(query, updateDDoc);
      res.send(result);
    });

    app.patch("/admin/update-custom-request-asset-info/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const status = req.body.status;
      const updateDDoc = {
        $set: {
          status: status,
        },
      };
      const result = await customRequestCollection.updateOne(query, updateDDoc);
      res.send(result);
    });

    app.patch("/users/update-profile/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const profileInfo = req.body;
      const updateDDoc = {
        $set: {
          name: profileInfo.name,
          dob: profileInfo.dob,
        },
      };
      const result = await usersCollection.updateOne(query, updateDDoc);
      res.send(result);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Asset Manager is available");
});

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
