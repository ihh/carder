#!/usr/bin/env node

const Dealer = require('../js/dealer.js')
const FakeCarder = require('./fake-carder.js')

let c = new FakeCarder()

const config = {
  carder: c,
  cards: [{ html: 'test card' }]
}

let d = new Dealer (config)
d.nextCard()
