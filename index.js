const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const query = require('express/lib/middleware/query');
require('dotenv').config()
const port = process.env.PORT || 5000;
const app = express();

// middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6b29w.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run () {
    try{
        await client.connect();
        const toolCollection = client.db('pranto-car-accessories').collection('tools');
        const bookingCollection = client.db('pranto-car-accessories').collection('bookings');
        const userCollection = client.db('pranto-car-accessories').collection('users');

        // all tools
        app.get('/tools', async (req, res) => {
            const query = {};
            const cursor = toolCollection.find(query);
            const tools = await cursor.toArray();
            res.send(tools);
        })
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
        app.get('/purchase', async (req, res) => {
            const userEmail = req.query.userEmail;
            const query = {userEmail: userEmail};
            const result = await bookingCollection.find(query).toArray();
            res.send(result) 
        })

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
