const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose'); 
const request = require('request');
const bodyParser = require('body-parser');
const path = require('path');
const Blockchain = require('./blockchain/index');
const PubSub = require('./app/pubsub');
const TransactionPool = require('./wallet/transaction-pool');
const Wallet = require('./wallet');
const TransactionMiner = require('./app/transaction-miner');
const Validators = require('./validators');
const ValidatorsCCR = require('./validators/validatorsCCR');
const fs = require('fs');


const app = express();
const blockchain = new Blockchain();
const transactionPool = new TransactionPool();
const wallet = new Wallet();
const validators = new Validators();
const validatorsCCR = new ValidatorsCCR();
const pubsub = new PubSub({ blockchain, transactionPool, wallet, validators, validatorsCCR});
const transactionMiner = new TransactionMiner({ blockchain, transactionPool, wallet, pubsub });

const DEFAULT_PORT = 3000;
const ROOT_NODE_ADDRESS = `http://localhost:${DEFAULT_PORT}`;

app.use(bodyParser.json());
app.use(express.urlencoded());
app.use(cors());
app.use(express.static(path.join(__dirname,'client/dist')));

mongoose.connect('mongodb://localhost:27017/treechain', {
    useNewUrlParser: true,
    useUnifiedTopology: true
},() => { console.log("DB connection established" )})

const userSchema = new mongoose.Schema({
    name: { type: String, required: true},
    email: { type: String, required: true},
    password: { type: String, required: true}
});

const User = new mongoose.model("user", userSchema);
//Routes

app.post("/login", (req, res)=> {
    const { email, password} = req.body
    User.findOne({ email: email}, (err, user) => {
        if(user){
            if(password === user.password ) {
                res.send({message: "Login Successfull", user: user})
            } else {
                res.send({ message: "Password didn't match"})
            }
        } else {
            res.send({message: "User not registered"})
        }
    })
}) 

app.post("/register", (req, res)=> {
    const { name, email, password} = req.body
    User.findOne({email: email}, (err, user) => {
        if(user){
            res.send({message: "User already registerd"})
        } else {
            const user = new User({
                name,
                email,
                password
            })
            user.save(err => {
                if(err) {
                    res.send(err)
                } else {
                    res.send( { message: "Successfully Registered, Please login now." })
                }
            })
        }
    })
    
}) 

app.get('/api/blocks', (req, res) => {
    let chain = [];
    let transactionsMap = blockchain.chain[0].validatorsMap;
    if(transactionsMap) {
        for(let key of Object.keys(transactionsMap)) {
            let value =  transactionsMap[key];
            for(let i=0;i<value.length;i++) {
                chain.push(value[i]);
            }
        }
    }
    res.json(chain);
});

app.get('/api/chain', (req, res) => {
    res.json(blockchain.chain[0].validatorsMap);
});


app.post('/api/validators', (req, res) => {
    const { validatorId } = req.body;
    validators.addValidator(validatorId);
    blockchain.addValidator(validatorId);
    pubsub.broadcastValidators(validatorId);
    validatorsCCR.distributeCCR(validators.validators);
    res.json({ type: 'success', validatorId });
});

app.get('/api/validators', (req, res) => {
    res.json(blockchain.chain[0]);
});



app.post('/api/test', (req, res) => {
    let previousTime = Date.now();
    let data = '';
    let validatorId = 'a';
    for(let j=1;j<=60;j++) {
        let time = 0;
        validatorId += 'b';
        validators.addValidator(validatorId);
        blockchain.addValidator(validatorId);
        pubsub.broadcastValidators(validatorId);

        for(let i=1;i<=10;i++) {
            const amount = 1;
            const recipient = 'test';
            let chain = [];
            let transactionsMap = blockchain.chain[0].validatorsMap;
            for(let key of Object.keys(transactionsMap)) {
                let value =  transactionsMap[key];
                for(let i=0;i<value.length;i++) {
                    chain.push(value[i]);
                }
            }
            let transaction = transactionPool
                .existingTransaction({ inputAddress: wallet.publicKey });

            try {
                if (transaction) {
                    transaction.update({ senderWallet: wallet, recipient, amount });
                }
                else {
                    transaction = wallet.createTransaction({ recipient, amount, chain});
                }
            } catch (error) {
                return res.status(400).json({ type: 'error', message: error.message });
            };

            transactionPool.setTransaction(transaction);

            pubsub.broadcastTransaction(transaction);

            blockchain.addValidatedBlock({ transaction, validatorId: wallet.publicKey});
            transactionPool.deleteTransaction(transaction.id);
            pubsub.broadcastChain(blockchain.chain[0].validatorsMap);
            // console.log(i,'Block added. Time taken: ',Date.now()-previousTime,' ms');
            time += Date.now()-previousTime;
            previousTime = Date.now();
        }
        data += j;
        data += ' : ';
        data += time;
        data += '\n';
    }
    // console.log('Average time taken: ', time/25, ' ms');
    
    fs.writeFile('Output.txt', data, (err) => {
      
        // In case of a error throw err.
        if (err) throw err;
    })
});

app.post('/api/transact', (req, res) => {
    const { amount, recipient } = req.body;
    let chain = [];
    let transactionsMap = blockchain.chain[0].validatorsMap;
    for(let key of Object.keys(transactionsMap)) {
        let value =  transactionsMap[key];
        for(let i=0;i<value.length;i++) {
            chain.push(value[i]);
        }
    }
    let transaction = transactionPool
        .existingTransaction({ inputAddress: wallet.publicKey });

    try {
        if (transaction) {
            transaction.update({ senderWallet: wallet, recipient, amount });
        }
        else {
            transaction = wallet.createTransaction({ recipient, amount, chain});
        }
    } catch (error) {
        return res.status(400).json({ type: 'error', message: error.message });
    };

    transactionPool.setTransaction(transaction);

    pubsub.broadcastTransaction(transaction);

    res.json({ type: 'success', transaction });
});

app.get('/api/transaction-pool-map', (req, res) => {
    res.json(transactionPool.transactionMap);
});

app.get('/api/mine-transactions', (req, res) => {
    transactionMiner.mineTransactions();

    res.redirect('/api/blocks');
});

app.get('/api/mine-validator-transactions', (req, res) => {
    let allTransactions = transactionPool.validTransactions();
    let transactionsToBeMined = [];
    let flag = 0;
    for(let i=0;i<allTransactions.length;i++) {
        let transactionId = allTransactions[i].id;
        let hash = transactionIdHash(transactionId);
        if(validatorsCCR.validatorMap.has(wallet.publicKey)) {
            let range = validatorsCCR.validatorMap.get(wallet.publicKey);
            if(range[0]<=hash && range[1]>=hash) {
                flag=1;
                blockchain.addValidatedBlock({ transaction: allTransactions[i], validatorId: wallet.publicKey});
                transactionPool.deleteTransaction(transactionId);
            }
        }
    }
    pubsub.broadcastChain(blockchain.chain[0].validatorsMap);
    if(flag === 0) {
       res.json('No transactions to be mined');
    }
    else {
        res.json('');
    }
    
});

app.get('/api/wallet-info', (req, res) => {
    const address = wallet.publicKey;
    let chain = [];
    let transactionsMap = blockchain.chain[0].validatorsMap;
    for(let key of Object.keys(transactionsMap)) {
        let value =  transactionsMap[key];
        for(let i=0;i<value.length;i++) {
            chain.push(value[i]);
        }
    }
    res.json({
        address,
        balance: Wallet.calculateBalance({ chain, address})
    });
});

app.get('*', (req, res) =>{
    res.sendFile(path.join(__dirname,'client/dist/index.html'));
});

const syncWithRootState = () => {
    request({ url: `${ROOT_NODE_ADDRESS}/api/chain` }, (error, response, body) => {
        if (!error && response.statusCode === 200) {
            const rootChain = JSON.parse(body);
            
            blockchain.replaceChain(rootChain);
        }
    });

    request({ url: `${ROOT_NODE_ADDRESS}/api/transaction-pool-map` }, (error, response, body) => {
        if (!error && response.statusCode === 200) {
            const rootTransactionPoolMap = JSON.parse(body);
            transactionPool.setMap(rootTransactionPoolMap);
        }
    });
};

const walletFoo = new Wallet();
const walletBar = new Wallet();

const generateWalletTransaction = ({ wallet, recipient, amount}) =>{
    const transaction = wallet.createTransaction({
        recipient, amount, chain: blockchain.chain
    });

    transactionPool.setTransaction(transaction);
};

const walletAction = () => generateWalletTransaction({
    wallet, recipient: walletFoo.publicKey, amount: 5
});

const walletFooAction = () => generateWalletTransaction({
    wallet: walletFoo, recipient: walletBar.publicKey, amount: 10
});

const walletBarAction = () => generateWalletTransaction({
    wallet: walletBar, recipient: wallet.publicKey, amount: 15
});

const transactionIdHash = (transactionId) => {
    let num = 0;
    for(let i=0;i<transactionId.length;i++) {
        num+=transactionId.charCodeAt(i);
    }
    return num%62;
}


/*for(let i=0;i<10;i++){
    if(i%3 === 0){
        walletAction();
        walletFooAction();
    }
    else if(i%3 === 1){
        walletAction();
        walletBarAction();
    }
    else{
        walletFooAction();
        walletBarAction();
    }

    transactionMiner.mineTransactions();
}*/

let PEER_PORT;

if (process.env.GENERATE_PEER_PORT === 'true') {
    PEER_PORT = DEFAULT_PORT + Math.ceil(Math.random() * 1000);
}

const PORT = PEER_PORT || DEFAULT_PORT;
app.listen(PORT, () => {
    console.log(`listening at localhost:${PORT}`);

    if (PORT !== DEFAULT_PORT) {
        let time = Date.now();
        syncWithRootState();
        console.log(Date.now()-time,' ms');
        // fs.writeFile('Output.txt', Date.now()-time, (err) => {
      
            // In case of a error throw err.
            // if (err) throw err;
        // })
    }
});

module.exports.obj = pubsub;