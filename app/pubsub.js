const PubNub = require('pubnub');

const credentials = {
    publishKey: 'pub-c-edd29309-3bb0-452d-83e0-41e0b30ec5af',
    subscribeKey: 'sub-c-6140050c-874c-11eb-a540-2a2aff149455',
    secretKey: 'sec-c-ZWUxNTQ2ODItNjY4Mi00ZWU1LWFlYWMtOTRhMmUyYWFiZjBi'
};


const CHANNELS = {
    TEST: 'TEST',
    BLOCKCHAIN: 'BLOCKCHAIN',
    TRANSACTION: 'TRANSACTION'
};

class PubSub {
    constructor({ blockchain, transactionPool, wallet }) {
        this.blockchain = blockchain;
        this.transactionPool = transactionPool;
        this.wallet = wallet;

        this.pubnub = new PubNub(credentials);

        this.pubnub.subscribe({ channels: Object.values(CHANNELS) });

        this.pubnub.addListener(this.listener());
    }

    broadcastChain() {
        this.publish({
            channel: CHANNELS.BLOCKCHAIN,
            message: JSON.stringify(this.blockchain.chain)
        });
    }

    broadcastTransaction(transaction){
        this.publish({
            channel: CHANNELS.TRANSACTION,
            message: JSON.stringify(transaction)
          });
    }

    listener() {
        return {
            message: messageObject => {
                const { channel, message } = messageObject;
                console.log(`Message received. Channel: ${channel}. Message: ${message}`);
                
                const parsedMessage = JSON.parse(message);
                switch(channel){
                    case CHANNELS.BLOCKCHAIN:
                        this.blockchain.replaceChain(parsedMessage, true, () => {
                            this.transactionPool.clearBlockchainTransactions({chain: parsedMessage});
                        });
                        break;
                    case CHANNELS.TRANSACTION:
                        if (!this.transactionPool.existingTransaction({
                            inputAddress: this.wallet.publicKey
                          })) {
                            this.transactionPool.setTransaction(parsedMessage);
                          }
              
                        break;
                    default:
                        return;
                }
            }
        };
    }

    publish({ channel, message }) {
        this.pubnub.publish({ message, channel });
    }
}

module.exports = PubSub;
