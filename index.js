const express = require('express');
const cors = require('cors');
var jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const query = require('express/lib/middleware/query');
require('dotenv').config()

const stripe = require("stripe")(process.env.STRTPE_SECRET_KEY);


const port = process.env.PORT || 5000;
const app = express();

// middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6b29w.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT (req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({message: 'unAuthorized access'});
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded){
        if (err) {
            return res.status(403).send({message: 'Forbidden access'})
        }
        req.decoded = decoded;
        next();
    })
}

async function run () {
    try{
        await client.connect();
        const toolCollection = client.db('pranto-car-accessories').collection('tools');
        const bookingCollection = client.db('pranto-car-accessories').collection('bookings');
        const userCollection = client.db('pranto-car-accessories').collection('users');
        const paymentCollection = client.db('pranto-car-accessories').collection('payments');
        const reviewCollection = client.db('pranto-car-accessories').collection('reviews');
        const profileCollection = client.db('pranto-car-accessories').collection('profiles');

        // all tools
        app.get('/tools', async (req, res) => {
            const query = {};
            const cursor = toolCollection.find(query);
            const tools = await cursor.toArray();
            res.send(tools);
        })
        // add product
        app.post('/tools', async (req, res) => {
            const purchase = req.body;
            const result = await toolCollection.insertOne(purchase);
            res.send(result)
        })

         // delete item
         app.delete('/tools/:id', async(req, res) => {
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const result = await toolCollection.deleteOne(query);
            res.send(result);
        });

        // single tool details
        app.get('/tools/:id', async (req, res) => {
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const tool = await toolCollection.findOne(query);
            res.send(tool)
        })
        // post
        app.post('/purchase', async (req, res) => {
            const purchase = req.body;
            const result = await bookingCollection.insertOne(purchase);
            res.send(result)
        })
        // single user order
        app.get('/purchase', verifyJWT, async (req, res) => {
            const userEmail = req.query.userEmail;
            const decodedEmail = req.decoded.email;
            if (userEmail === decodedEmail) {
                const query = {userEmail: userEmail};
                const result = await bookingCollection.find(query).toArray();
                return res.send(result) 
            }
            else{
                return res.status(403).send({message: 'Forbidden access'})
            }
        })

          // delete order
          app.delete('/purchase/:id', async(req, res) => {
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const result = await bookingCollection.deleteOne(query);
            res.send(result);
        });

        // user email 
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = {email: email};
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({email: email}, process.env.ACCESS_TOKEN_SECRET, { expiresIn: 60 * 60 })
            res.send({result, token})
        })
        // All users
        app.get('/user', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users)
        })
        // admin
        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne
            ({email: requester});
            if (requesterAccount.role === 'admin') {
                const filter = {email: email};
                const updateDoc = {
                    $set: {role: 'admin'},
                };
                const result = await userCollection.updateOne(filter, updateDoc);
                res.send(result)
            }
            else{
                return res.status(403).send({message: 'Forbidden'})
            }
        })
        // admin delete
        app.delete('/user/admin/:id', async(req, res) => {
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const result = await userCollection.deleteOne(query);
            res.send(result);
        });

        // if user is not admin
        app.get('/admin/:email', async(req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({email: email});
            const isAdmin = user.role === 'admin';
            res.send({admin: isAdmin})
        })

        // payment 
        app.get('/purchase/:id',  async (req, res) => {
            const id = req.params.id;
            const query = {_id: ObjectId(id)};
            const result = await bookingCollection.findOne(query);
            res.send(result);
        })

        app.post("/create-payment-intent", async (req, res) => {
            const sevice = req.body;
            const price = sevice.price;
            const amount = price * 100;
            const paymentIntent = await stripe.paymentIntents.create({
                amount : amount,
                currency : 'usd',
                payment_method_types : ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            })
        })

        app.patch('/purchase/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = {_id: ObjectId(id)};
            const updateDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId,

                }
            }
            const result = await paymentCollection.insertOne(payment);
            const updatedBooking = await bookingCollection.updateOne(filter, updateDoc);
            res.send(updatedBooking)
        })

        // review 
        app.post('/review', async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send(result)
        })
        app.get('/review', async (req, res) => {
            const reviews = await reviewCollection.find().toArray();
            res.send(reviews)
        })

        // Profile
        app.post('/profile', async (req, res) => {
            const review = req.body;
            const result = await profileCollection.insertOne(review);
            res.send(result)
        })
        app.get('/profile', async (req, res) => {
            const reviews = await profileCollection.find().toArray();
            res.send(reviews)
        })
        app.put('/profile/:id', async (req, res) => {
            const email = req.params.email;
            const data = req.body;
            const filter = {email: email};
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    education: data.education,
                    location: data.location,
                    phoneNumber: data.phoneNumber,
                    hobbies: data.hobbies
                },
            };
            const result = await profileCollection.updateOne(filter, updateDoc, options);
            res.send(result)
        })


    }
    finally {

    }
}
run().catch(console.dir)


app.get('/', (req, res) => {
    res.send('Running Server');
});

app.listen(port, () => {
    console.log('Listening to port', port);
})
