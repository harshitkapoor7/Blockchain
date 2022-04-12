import React, { Component, useEffect, useState } from 'react';
import { Button } from 'react-bootstrap';
import BootstrapSwitchButton from 'bootstrap-switch-button-react'
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import ReactTooltip from 'react-tooltip';
import copy from "copy-to-clipboard";
import { ToastContainer, toast } from 'react-toastify';
import Sidebar from './Sidebar';

//pubsub =  require('../../../index').obj;


const HomePage = ({ user, setLoginUser }) => {
    const [state, setState] = useState({ walletInfo: {}, validatorInterest: false });

    const toggleValidatorInterest = () => {
        setState({ walletInfo: state.walletInfo, validatorInterest: !state.validatorInterest });
        fetch(`${document.location.origin}/api/validators`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ validatorId: state.walletInfo.address })
        }).then(response => response.json())

        //console.log('hello', pubsub);
    };

    const handleCopy = () => {
        copy(address);
        toast('🦄 Copied!', {
            position: "top-right",
            autoClose: 300,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            progress: undefined,
            });
    };

    const test = () => {
        fetch(`${document.location.origin}/api/test-node`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ validatorId: state.walletInfo.address })
        }).then(response => response.json())
    };

    useEffect(() => {
        fetch(`${document.location.origin}/api/wallet-info`)
            .then(response => response.json())
            .then(json => setState({ walletInfo: json }));
    }, [])


    const { address, balance } = state.walletInfo;
    return (
        <div className='HomePage'>
            <div className='AccountDetails'>




                {/* <div className="button" onClick={() => setLoginUser({})} >Logout</div> */}
                <img className='logo' src={logo}></img>
                <br />
                <div>Welcome to AgroChain</div>
                {/* <br/> */}
                {/* <div><Link to='/blocks'>Blocks</Link></div> */}
                {/* <div><Link to='/conduct-transaction'>Conduct a Transaction</Link></div> */}
                {/* <div><Link to='/transaction-pool'>Transaction Pool</Link></div> */}
                <br />
                <Container className='WalletInfo'>
                    <Row className='WalletInfoRowMiddle'>
                        <Col className='WalletInfoColumn'>Name</Col>
                        <Col className='WalletInfoColumnRight' xs={8}>{user.name}</Col>
                    </Row>
                    <Row className='WalletInfoRowMiddle'>
                        <Col className='WalletInfoColumn'>Email</Col>
                        <Col className='WalletInfoColumnRight' xs={8}>{user.email}</Col>
                    </Row>
                    <Row className='WalletInfoRowMiddle'>
                        <Col className='WalletInfoColumn'>Wallet Address</Col>
                        <Col data-tip="Click to copy" data-for="copyTip" className='WalletAddressColumnRight' xs={8} onClick={handleCopy} id="animate.css">{address}
                        <ToastContainer />
                        <ReactTooltip id="copyTip" place="right" type="light" effect="solid">
                            Click to Copy
                        </ReactTooltip>
                        </Col>
                    </Row>
                    <Row className='WalletInfoRowMiddle'>
                        <Col className='WalletInfoColumn'>Balance</Col>
                        <Col className='WalletInfoColumnRight' xs={8}>{balance}</Col>
                    </Row>
                </Container>
            </div>
            <div className='ValidationToggle'>
                <div style={{ fontSize: "12.5px", margin: "10px" }}>Interested in Transaction Validation?</div>
                <BootstrapSwitchButton
                    width={50} onlabel='Yes' offlabel='No' checked={false}
                    onstyle="danger" offstyle="info"
                    onChange={toggleValidatorInterest} />
            </div>
        </div>
    );

}

export default HomePage;