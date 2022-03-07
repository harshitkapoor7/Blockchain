import React, { Component } from 'react';
import { Button } from 'react-bootstrap';
import BootstrapSwitchButton from 'bootstrap-switch-button-react'
import {Link} from 'react-router-dom';
import logo from '../assets/logo.png';
//pubsub =  require('../../../index').obj;


class App extends Component {
    state = { walletInfo: {}, validatorInterest: false };

    toggleValidatorInterest = () => {
        this.setState({ walletInfo: this.state.walletInfo, validatorInterest: !this.state.validatorInterest });
        fetch(`${document.location.origin}/api/validators`,{
            method: 'POST',
            headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify({ validatorId: this.state.walletInfo.address})
        }).then( response => response.json())
        
        //console.log('hello', pubsub);
    };

    test = () => {
        fetch(`${document.location.origin}/api/test-node`,{
            method: 'POST',
            headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify({ validatorId: this.state.walletInfo.address})
        }).then( response => response.json())
    };

    componentDidMount() {
        fetch(`${document.location.origin}/api/wallet-info`)
            .then(response => response.json())
            .then(json => this.setState({ walletInfo: json }));
    }

    render() {
        const { address, balance } = this.state.walletInfo;
        return (
            <div className='App'>
                <div>
                    <div className='ValidationToggle'>
                        <div style={{fontSize: "12.5px", margin: "10px"} }>Interested in Transaction Validation?</div>
                        <BootstrapSwitchButton 
                            width={50} onlabel='Yes' offlabel='No' checked={false} 
                            onstyle="danger" offstyle="info" 
                            onChange={this.toggleValidatorInterest} />
                    </div>
                    <Button
                        variant="danger"
                        size="sm"
                        onClick={this.test}>
                        Show Less
                    </Button>
                </div>
                <img className='logo' src={logo}></img>
                <br/>
                <div>Welcome to the blockchain</div>
                <br/>
                <div><Link to='/blocks'>Blocks</Link></div>
                <div><Link to='/conduct-transaction'>Conduct a Transaction</Link></div>
                <div><Link to='/transaction-pool'>Transaction Pool</Link></div>
                <br/>
                <div className='WalletInfo'>
                    <div>Address: {address}</div>
                    <div>Balance: {balance}</div>
                </div>
            </div>
        );
    }
}

export default App;