const express = require('express');
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
app.use(express.static(path.join(__dirname,'client/dist')));

app.get('/api/blocks', (req, res) => {
    let chain = [];
    let transactionsMap = blockchain.chain[0].validatorsMap;
    if(transactionsMap) {
        for(let value of transactionsMap.values()) {
            for(let i=0;i<value.length;i++) {
                chain.push(value[i]);
            }
        }
    }
    res.json(chain);
});

app.get('/api/chain', (req, res) => {
    res.json(blockchain.chain);
});


/*app.post('/api/mine', (req, res) => {
    const { data } = req.body;
    blockchain.addBlock({ data });

    pubsub.broadcastChain();

    res.redirect('/api/blocks');
});*/

app.post('/api/validators', (req, res) => {
    const { validatorId } = req.body;
    validators.addValidator(validatorId);
    blockchain.addValidator(validatorId);
    pubsub.broadcastValidators(validatorId);
    validatorsCCR.distributeCCR(validators.validators);
    //pubsub.broadcastValidatorsCCR(validatorId);
    let today = new Date();
    let date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
    let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    let dateTime = date+' '+time;
    console.log(dateTime,validatorId, validators);
    console.log(dateTime, blockchain.chain[0]);
    res.json({ type: 'success', validatorId });
});

app.get('/api/validators', (req, res) => {
    // validatorsCCR.distributeCCR(validators.validators);
    // let transactionsToBeMined = transactionPool.validTransactions();
    // console.log(transactionsToBeMined);
    res.json(blockchain.chain[0]);
});

app.post('/api/transact', (req, res) => {
    const { amount, recipient } = req.body;
    let chain = [];
    let transactionsMap = blockchain.chain[0].validatorsMap;
    for(let value of transactionsMap.values()) {
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
    //transactionMiner.mineTransactions();
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
    console.log('Printing in validator mine',blockchain.chain[0].validatorsMap);
    setTimeout(() => pubsub.broadcastChain(blockchain.chain[0]),2000);
    if(flag === 0) {
       res.json('No transactions to be mined');
    }
    else {
        res.json('');
    }
    
    //res.redirect('/api/blocks');
});

app.get('/api/wallet-info', (req, res) => {
    const address = wallet.publicKey;
    let chain = [];
    let transactionsMap = blockchain.chain[0].validatorsMap;
    for(let value of transactionsMap.values()) {
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

           //  console.log('replace chain on a sync with', rootChain);
            
            blockchain.replaceChain(rootChain.validatorsMap);
        }
    });

    request({ url: `${ROOT_NODE_ADDRESS}/api/transaction-pool-map` }, (error, response, body) => {
        if (!error && response.statusCode === 200) {
            const rootTransactionPoolMap = JSON.parse(body);

            // console.log('replace transaction pool map on a sync with', rootTransactionPoolMap);
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

    if (PORT !== DEFAULT_PORT) syncWithRootState();
});

module.exports.obj = pubsub;