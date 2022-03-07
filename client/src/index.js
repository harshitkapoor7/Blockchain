import React from 'react';
import { render } from 'react-dom';
import { Router, Switch, Route } from 'react-router-dom';
import history from './history';
import Login from "./components/login/login"
import Register from "./components/register/register"
import App from './components/app';
import Blocks from './components/Blocks';
import ConductTransaction from './components/ConductTransaction';
import TransactionPool from './components/TransactionPool';
import './index.css';

render(
    <Router history={history}>
        <Switch>
        
            <Route exact path='/' component={App} />
            <Route path="/login">
            <Login />
          </Route>
          <Route path="/register">
            <Register />
          </Route>
            <Route path='/blocks' component={Blocks} />
            <Route path='/conduct-transaction' component={ConductTransaction} />
            <Route path='/transaction-pool' component={TransactionPool} />
        </Switch>
    </Router>,
    document.getElementById('root')
);